import { useCallback, useRef, useState } from "react";

import type { StagedImage } from "@/lib/upload/types";
import type {
  ExtractionJob,
  PipelineState,
} from "./types";
import { runBatchPipeline } from "./batch";

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

      try {
        const result = await runBatchPipeline(images, {
          callbacks: {
            onExtractStart: (imageId) => {
              updateJob(imageId, { status: "extracting" });
            },
            onExtractSuccess: (imageId, markdown, model) => {
              updateJob(imageId, { status: "done", markdown, model });
            },
            onExtractError: (imageId, error) => {
              updateJob(imageId, { status: "failed", error });
            },
          },
        });

        setState((prev) => ({
          ...prev,
          stage: "completed",
          jobs: prev.jobs.map((j) =>
            j.status !== "failed" ? { ...j, status: "done" as const } : j,
          ),
          result,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          stage: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        }));
      }
    },
    [updateJob],
  );

  const retryJob = useCallback(
    async (imageId: string, images: StagedImage[]) => {
      const image = images.find((i) => i.id === imageId);
      if (!image) return;

      updateJob(imageId, { status: "extracting", error: null });

      try {
        const { resizeImageToDataUrl } = await import("@/lib/upload/resize");
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
