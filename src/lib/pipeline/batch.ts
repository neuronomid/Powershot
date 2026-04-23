import { dedupChunkList } from "@/lib/dedup/deterministic";
import { processImageForExtraction } from "@/lib/upload/process-image";
import type { StagedImage } from "@/lib/upload/types";
import type {
  ChunkAnchor,
  OrderingWarning,
  PipelineResult,
  PipelineTiming,
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
    offset = end + 2;
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

export type PipelineCallbacks = {
  onExtractStart?: (imageId: string) => void;
  onExtractSuccess?: (imageId: string, markdown: string, model: string) => void;
  onExtractError?: (imageId: string, error: string) => void;
  onDedupStart?: () => void;
  onReviewStart?: (preReviewMarkdown: string) => void;
  onReviewEnd?: () => void;
};

export async function runBatchPipeline(
  images: StagedImage[],
  options: { signal?: AbortSignal; callbacks?: PipelineCallbacks; enhance?: boolean } = {},
): Promise<PipelineResult & { timing?: PipelineTiming }> {
  const { signal, callbacks, enhance } = options;

  const extractionResults = new Map<
    string,
    { markdown: string; model: string }
  >();
  const failedImages = new Set<string>();

  // ─── Phase 1: Extract ───
  const tExtract0 = performance.now();
  await runWithConcurrency(images, 4, async (image) => {
    if (signal?.aborted) return;
    callbacks?.onExtractStart?.(image.id);

    try {
      const dataUrl = await processImageForExtraction(image, {
        enhance: enhance && image.source !== "pdf-page",
      });
      if (signal?.aborted) return;

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ image: dataUrl, imageCount: images.length }),
      });

      if (signal?.aborted) return;

      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = (await res.json()) as { markdown: string; model: string };
      extractionResults.set(image.id, data);
      callbacks?.onExtractSuccess?.(image.id, data.markdown, data.model);
    } catch (err) {
      if (signal?.aborted) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      failedImages.add(image.id);
      const message = err instanceof Error ? err.message : "Unknown error";
      callbacks?.onExtractError?.(image.id, message);
    }
  });
  const extractionMs = Math.round(performance.now() - tExtract0);

  if (signal?.aborted) {
    throw new Error("Aborted");
  }

  const successfulImages = images.filter((img) => !failedImages.has(img.id));

  if (successfulImages.length === 0) {
    throw new Error("All extractions failed. Please retry.");
  }

  const chunks = successfulImages.map(
    (img) => extractionResults.get(img.id)!.markdown,
  );
  const imageIds = successfulImages.map((img) => img.id);

  // ─── Phase 2: Deterministic dedup ───
  callbacks?.onDedupStart?.();
  const tDedup0 = performance.now();
  const dedupedChunks = dedupChunkList(chunks);
  let anchors = buildAnchors(dedupedChunks, imageIds);

  for (let i = 0; i < dedupedChunks.length; i++) {
    const originalLen = chunks[i]!.length;
    const newLen = dedupedChunks[i]!.length;
    if (newLen < originalLen) {
      const removed = originalLen - newLen;
      anchors = updateAnchorsAfterRemoval(anchors, i, removed);
    }
  }

  if (signal?.aborted) {
    throw new Error("Aborted");
  }

  // ─── Phase 3: Semantic dedup ───
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
        signal,
        body: JSON.stringify({ pairs }),
      });

      if (res.ok) {
        const data = (await res.json()) as {
          results: Array<{
            index: number;
            deletionSpans: Array<{ start: number; end: number }>;
          }>;
        };

        for (const result of data.results ?? []) {
          const chunkIdx = result.index + 1;
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
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
        throw new Error("Aborted");
      }
      console.error("[pipeline] Semantic dedup failed:", err);
    }
  }
  const dedupMs = Math.round(performance.now() - tDedup0);

  if (signal?.aborted) {
    throw new Error("Aborted");
  }

  // ─── Phase 4: Review ───
  const combinedMarkdown = dedupedChunks.join("\n\n");
  callbacks?.onReviewStart?.(combinedMarkdown);

  const tReview0 = performance.now();
  let finalMarkdown = combinedMarkdown;
  let warnings: OrderingWarning[] = [];
  let tokenSubsetViolations: string[] | null = null;

  try {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
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
    if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) {
      throw new Error("Aborted");
    }
    console.error("[pipeline] Review failed:", err);
  }
  const reviewMs = Math.round(performance.now() - tReview0);
  callbacks?.onReviewEnd?.();

  return {
    markdown: finalMarkdown,
    warnings,
    tokenSubsetViolations,
    anchors,
    preReviewMarkdown: combinedMarkdown,
    timing: {
      extractionMs,
      dedupMs,
      reviewMs,
      totalMs: extractionMs + dedupMs + reviewMs,
    },
  };
}
