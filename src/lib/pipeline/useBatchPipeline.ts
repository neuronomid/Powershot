import { useCallback, useRef, useState } from "react";

import { dedupChunkList } from "@/lib/dedup/deterministic";
import { resizeImageToDataUrl } from "@/lib/upload/resize";
import type { StagedImage } from "@/lib/upload/types";
import type {
  ChunkAnchor,
  ExtractionJob,
  OrderingWarning,
  PipelineState,
} from "./types";

function buildAnchors(chunks: string[], imageIds: string[]): ChunkAnchor[] {
  const anchors: ChunkAnchor[] = [];
  let offset = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    const imageId = imageIds[i]!;
    const start = offset;
    const end = offset + chunk.length;
    anchors.push({ imageId, startOffset: start, endOffset: end });
    offset = end + 2; // account for "\n\n" separator
  }
  return anchors;
}

function updateAnchorsAfterRemoval(
  anchors: ChunkAnchor[],
  chunkIndex: number,
  removedCount: number,
): ChunkAnchor[] {
  return anchors.map((a, idx) => {
    if (idx < chunkIndex) return a;
    if (idx === chunkIndex) {
      return {
        ...a,
        endOffset: Math.max(a.startOffset, a.endOffset - removedCount),
      };
    }
    return {
      ...a,
      startOffset: Math.max(0, a.startOffset - removedCount),
      endOffset: Math.max(0, a.endOffset - removedCount),
    };
  });
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
) {
  const queue = items.map((item, index) => ({ item, index }));
  const running = new Set<Promise<void>>();

  while (queue.length > 0 || running.size > 0) {
    while (running.size < concurrency && queue.length > 0) {
      const { item, index } = queue.shift()!;
      const promise = fn(item, index).finally(() => running.delete(promise));
      running.add(promise);
    }
    if (running.size > 0) {
      await Promise.race(running);
    }
  }
}

const initialState: PipelineState = {
  stage: "idle",
  jobs: [],
  result: null,
  error: null,
};

export function useBatchPipeline() {
  const [state, setState] = useState<PipelineState>(initialState);
  const abortRef = useRef(false);

  const updateJob = useCallback(
    (imageId: string, patch: Partial<ExtractionJob>) => {
      setState((prev) => ({
        ...prev,
        jobs: prev.jobs.map((j) =>
          j.imageId === imageId ? { ...j, ...patch } : j,
        ),
      }));
    },
    [],
  );

  const run = useCallback(
    async (images: StagedImage[]) => {
      abortRef.current = false;

      const jobs: ExtractionJob[] = images.map((img) => ({
        imageId: img.id,
        fileName: img.file.name,
        status: "queued" as const,
        markdown: "",
        model: null,
        error: null,
        anchor: {
          imageId: img.id,
          startOffset: 0,
          endOffset: 0,
        },
      }));

      setState({
        stage: "extracting",
        jobs,
        result: null,
        error: null,
      });

      // ─── Phase 1: Extract ───
      await runWithConcurrency(images, 4, async (image) => {
        if (abortRef.current) return;
        updateJob(image.id, { status: "extracting" });

        try {
          const dataUrl = await resizeImageToDataUrl(image.file);
          if (abortRef.current) return;

          const res = await fetch("/api/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: dataUrl }),
          });

          if (abortRef.current) return;

          if (!res.ok) {
            const err = await res
              .json()
              .catch(() => ({ error: `HTTP ${res.status}` }));
            throw new Error(err.error || `HTTP ${res.status}`);
          }

          const data = (await res.json()) as {
            markdown: string;
            model: string;
          };

          updateJob(image.id, {
            status: "done",
            markdown: data.markdown,
            model: data.model,
          });
        } catch (err) {
          updateJob(image.id, {
            status: "failed",
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      });

      if (abortRef.current) return;

      // Collect successful jobs in order
      const successfulJobs = jobs
        .map((j, _idx) => ({ j, _idx }))
        .filter(({ j }) => j.status === "done");

      if (successfulJobs.length === 0) {
        setState((prev) => ({
          ...prev,
          stage: "failed",
          error: "All extractions failed. Please retry failed images.",
        }));
        return;
      }

      const chunks = successfulJobs.map(({ j }) => j.markdown);
      const imageIds = successfulJobs.map(({ j }) => j.imageId);

      // ─── Phase 2: Deterministic dedup ───
      setState((prev) => ({ ...prev, stage: "deduping" }));

      const dedupedChunks = dedupChunkList(chunks);
      let anchors = buildAnchors(dedupedChunks, imageIds);

      // Update anchors after deterministic dedup by comparing chunk lengths
      for (let i = 0; i < dedupedChunks.length; i++) {
        const originalLen = chunks[i]!.length;
        const newLen = dedupedChunks[i]!.length;
        if (newLen < originalLen) {
          const removed = originalLen - newLen;
          anchors = updateAnchorsAfterRemoval(anchors, i, removed);
        }
      }

      if (abortRef.current) return;

      // ─── Phase 3: Semantic dedup ───
      // Only call API if we have adjacent pairs.
      if (dedupedChunks.length >= 2) {
        try {
          const pairs = [];
          for (let i = 0; i < dedupedChunks.length - 1; i++) {
            pairs.push({
              index: i,
              chunkA: dedupedChunks[i]!,
              chunkB: dedupedChunks[i + 1]!,
            });
          }

          const res = await fetch("/api/dedup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pairs }),
          });

          if (res.ok) {
            const data = (await res.json()) as {
              results: Array<{
                index: number;
                deletionSpans: Array<{ start: number; end: number }>;
              }>;
            };

            // Apply deletion spans (in reverse order so indices stay valid)
            for (const result of data.results ?? []) {
              const chunkIdx = result.index + 1; // chunkB is at index+1
              const spans = [...result.deletionSpans].sort(
                (a, b) => b.start - a.start,
              );
              let totalRemoved = 0;
              for (const span of spans) {
                const before = dedupedChunks[chunkIdx]!;
                const after =
                  before.slice(0, span.start) + before.slice(span.end);
                totalRemoved += before.length - after.length;
                dedupedChunks[chunkIdx] = after;
              }
              if (totalRemoved > 0) {
                anchors = updateAnchorsAfterRemoval(
                  anchors,
                  chunkIdx,
                  totalRemoved,
                );
              }
            }
          }
        } catch (err) {
          // Non-fatal: log and continue with deterministic dedup result only.
          console.error("[pipeline] Semantic dedup failed:", err);
        }
      }

      if (abortRef.current) return;

      // ─── Phase 4: Review ───
      setState((prev) => ({
        ...prev,
        stage: "reviewing",
        jobs: prev.jobs.map((j) =>
          j.status === "done" ? { ...j, status: "reviewing" as const } : j,
        ),
      }));

      const combinedMarkdown = dedupedChunks.join("\n\n");

      let finalMarkdown = combinedMarkdown;
      let warnings: OrderingWarning[] = [];
      let tokenSubsetViolations: string[] | null = null;

      try {
        const res = await fetch("/api/review", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ markdown: combinedMarkdown }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            markdown: string;
            warnings: OrderingWarning[];
            tokenSubsetViolations: string[] | null;
          };
          finalMarkdown = data.markdown;
          warnings = data.warnings ?? [];
          tokenSubsetViolations = data.tokenSubsetViolations ?? null;
        } else {
          console.error("[pipeline] Review HTTP error:", res.status);
        }
      } catch (err) {
        console.error("[pipeline] Review failed:", err);
        // Non-fatal: use combined markdown without review cleanup.
      }

      if (abortRef.current) return;

      // Update job statuses back to done
      setState((prev) => ({
        ...prev,
        stage: "completed",
        jobs: prev.jobs.map((j) =>
          j.status === "reviewing" ? { ...j, status: "done" as const } : j,
        ),
        result: {
          markdown: finalMarkdown,
          warnings,
          tokenSubsetViolations,
          anchors,
        },
      }));
    },
    [updateJob],
  );

  const retryJob = useCallback(
    async (imageId: string, images: StagedImage[]) => {
      const image = images.find((i) => i.id === imageId);
      if (!image) return;

      updateJob(imageId, { status: "extracting", error: null });

      try {
        const dataUrl = await resizeImageToDataUrl(image.file);
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl }),
        });

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: `HTTP ${res.status}` }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as {
          markdown: string;
          model: string;
        };
        updateJob(imageId, {
          status: "done",
          markdown: data.markdown,
          model: data.model,
        });
      } catch (err) {
        updateJob(imageId, {
          status: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },
    [updateJob],
  );

  const reset = useCallback(() => {
    abortRef.current = true;
    setState(initialState);
  }, []);

  return { state, run, retryJob, reset };
}
