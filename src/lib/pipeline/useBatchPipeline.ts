import { useCallback, useRef, useState } from "react";

import type { StagedImage } from "@/lib/upload/types";
import type {
  BatchProgress,
  ExtractionJob,
  PipelineStage,
  PipelineState,
  ReviewChangeSummary,
} from "./types";
import { computeReviewChanges } from "./review-diff";
import { runBatchPipeline } from "./batch";
import { MODEL_CHAIN } from "@/lib/ai/openrouter";

const PRIMARY_MODEL = MODEL_CHAIN[0];

const initialState: PipelineState = {
  stage: "idle",
  jobs: [],
  result: null,
  error: null,
  timing: null,
};

function computeProgress(
  stage: PipelineStage,
  jobs: ExtractionJob[],
  totalImages: number,
  extractionTimings: number[],
  currentEta: number | null,
): BatchProgress | null {
  if (stage === "idle" || stage === "failed") return null;
  if (totalImages <= 1) return null;

  const completed = jobs.filter(
    (j) => j.status === "done" || j.status === "failed",
  ).length;
  const inFlight = jobs.filter((j) => j.status === "extracting").length;

  const extractionProgress =
    totalImages > 0
      ? ((completed + inFlight * 0.5) / totalImages) * 0.7
      : 0;

  let stageProgress = 0;
  let label = "";
  let etaSeconds: number | null = null;

  switch (stage) {
    case "extracting":
      stageProgress = extractionProgress;
      label = `Extracting ${completed} of ${totalImages} images…`;
      etaSeconds = computeEtaSeconds(
        completed,
        totalImages,
        extractionTimings,
        currentEta,
      );
      break;
    case "deduping":
      stageProgress = 0.7 + 0.05;
      label = "Finding overlaps…";
      etaSeconds = 2;
      break;
    case "reviewing":
      stageProgress = 0.8 + 0.05;
      label = "Reviewing for structure…";
      etaSeconds = 1;
      break;
    case "completed":
      stageProgress = 1;
      label = "Done — opening editor";
      etaSeconds = 0;
      break;
    default:
      return null;
  }

  const percent = Math.min(100, Math.round(stageProgress * 100));
  return { percent, label, etaSeconds };
}

function computeEtaSeconds(
  completed: number,
  totalImages: number,
  timings: number[],
  currentEta: number | null,
): number | null {
  if (totalImages < 4) return null;
  if (completed < 3) return null;
  if (timings.length < 3) return null;

  const sortedTimings = [...timings].sort((a, b) => a - b);
  const median = sortedTimings[Math.floor(sortedTimings.length / 2)] ?? sortedTimings[0]!;

  const remaining = totalImages - completed;
  const estimated = Math.max(1, Math.round((median * remaining) / 1000));

  if (currentEta !== null && estimated > currentEta * 1.1) {
    return currentEta;
  }

  return estimated;
}

export function useBatchPipeline() {
  const [state, setState] = useState<PipelineState>(initialState);
  const [reviewChanges, setReviewChanges] = useState<ReviewChangeSummary | null>(null);
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const extractionTimingsRef = useRef<number[]>([]);
  const extractionStartTimesRef = useRef(new Map<string, number>());
  const etaRef = useRef<number | null>(null);

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
    async (images: StagedImage[], opts: { enhance?: boolean } = {}) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const runId = ++runIdRef.current;
      extractionTimingsRef.current = [];
      extractionStartTimesRef.current = new Map();
      etaRef.current = null;

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
        timing: null,
      });

      setReviewChanges(null);

      const totalImages = images.length;
      const t0 = performance.now();

      const refreshProgress = (currentStage: PipelineStage, currentJobs: ExtractionJob[]) => {
        if (controller.signal.aborted || runId !== runIdRef.current) return;
        const p = computeProgress(
          currentStage,
          currentJobs,
          totalImages,
          extractionTimingsRef.current,
          etaRef.current,
        );
        if (p) {
          etaRef.current = p.etaSeconds;
          setProgress(p);
        } else {
          setProgress(null);
        }
      };

      try {
        const result = await runBatchPipeline(images, {
          signal: controller.signal,
          enhance: opts.enhance,
          callbacks: {
            onExtractStart: (imageId) => {
              if (controller.signal.aborted || runId !== runIdRef.current) return;
              extractionStartTimesRef.current.set(imageId, performance.now());
              setState((prev) => {
                const updatedJobs = prev.jobs.map((j) =>
                  j.imageId === imageId ? { ...j, status: "extracting" as const } : j,
                );
                refreshProgress("extracting", updatedJobs);
                return { ...prev, jobs: updatedJobs };
              });
            },
            onExtractSuccess: (imageId, markdown, model) => {
              if (controller.signal.aborted || runId !== runIdRef.current) return;
              const startedAt = extractionStartTimesRef.current.get(imageId) ?? t0;
              extractionTimingsRef.current.push(performance.now() - startedAt);
              setState((prev) => {
                const updatedJobs = prev.jobs.map((j) =>
                  j.imageId === imageId
                    ? { ...j, status: "done" as const, markdown, model }
                    : j,
                );
                refreshProgress("extracting", updatedJobs);
                return { ...prev, jobs: updatedJobs };
              });
            },
            onExtractError: (imageId, error) => {
              if (controller.signal.aborted || runId !== runIdRef.current) return;
              const startedAt = extractionStartTimesRef.current.get(imageId) ?? t0;
              extractionTimingsRef.current.push(performance.now() - startedAt);
              setState((prev) => {
                const updatedJobs = prev.jobs.map((j) =>
                  j.imageId === imageId
                    ? { ...j, status: "failed" as const, error }
                    : j,
                );
                refreshProgress("extracting", updatedJobs);
                return { ...prev, jobs: updatedJobs };
              });
            },
            onDedupStart: () => {
              if (controller.signal.aborted || runId !== runIdRef.current) return;
              setState((prev) => {
                refreshProgress("deduping", prev.jobs);
                return { ...prev, stage: "deduping" };
              });
            },
            onReviewStart: (preReviewMarkdown: string) => {
              if (controller.signal.aborted || runId !== runIdRef.current) return;
              setState((prev) => {
                refreshProgress("reviewing", prev.jobs);
                return {
                  ...prev,
                  stage: "reviewing",
                  result: prev.result
                    ? { ...prev.result, preReviewMarkdown }
                    : null,
                };
              });
            },
            onReviewEnd: () => {
              // Stage transition to completed happens in the final setState
            },
          },
        });

        if (controller.signal.aborted || runId !== runIdRef.current) {
          return;
        }

        const totalMs = Math.round(performance.now() - t0);

        const preReviewMarkdown = result.preReviewMarkdown;
        const postReviewMarkdown = result.markdown;
        const changes = computeReviewChanges(preReviewMarkdown ?? "", postReviewMarkdown);
        setReviewChanges(changes);

        setState((prev) => ({
          ...prev,
          stage: "completed",
          jobs: prev.jobs.map((j) =>
            j.status !== "failed" ? { ...j, status: "done" as const } : j,
          ),
          result: {
            ...result,
            preReviewMarkdown,
          },
          timing: {
            extractionMs: result.timing?.extractionMs ?? 0,
            dedupMs: result.timing?.dedupMs ?? 0,
            reviewMs: result.timing?.reviewMs ?? 0,
            totalMs,
          },
        }));

        setProgress({
          percent: 100,
          label: "Done — opening editor",
          etaSeconds: 0,
        });
      } catch (err) {
        if (controller.signal.aborted || runId !== runIdRef.current) {
          return;
        }
        setState((prev) => ({
          ...prev,
          stage: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        }));
        setProgress(null);
      }
    },
    [],
  );

  const retryJob = useCallback(
    async (imageId: string, images: StagedImage[], opts: { enhance?: boolean; promptType?: string } = {}) => {
      const image = images.find((i) => i.id === imageId);
      if (!image) return;

      updateJob(imageId, { status: "extracting", error: null });

      try {
        const { processImageForExtraction } = await import("@/lib/upload/process-image");
        const dataUrl = await processImageForExtraction(image, {
          enhance: opts.enhance && image.source !== "pdf-page",
        });
        const body: Record<string, unknown> = { image: dataUrl, imageCount: images.length };
        if (opts.promptType) body.promptType = opts.promptType;
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
    runIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState(initialState);
    setReviewChanges(null);
    setProgress(null);
    extractionTimingsRef.current = [];
    extractionStartTimesRef.current = new Map();
    etaRef.current = null;
  }, []);

  const fallbackInfo = state.jobs.some(
    (j) => j.model !== null && j.model !== PRIMARY_MODEL,
  );

  return { state, progress, reviewChanges, fallbackInfo, run, retryJob, reset };
}

export { PRIMARY_MODEL };
