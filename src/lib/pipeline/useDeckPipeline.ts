import { useCallback, useRef, useState } from "react";

import type { StagedImage } from "@/lib/upload/types";
import type {
  Card,
  DeckPreferences,
  PerImageOverride,
} from "@/lib/flashcard/types";
import type { ExtractionJob } from "./types";
import {
  runFlashcardBatchPipeline,
  type FlashcardStage,
  type FlashcardBatchResult,
} from "./flashcard-batch";

export type DeckPipelineState = {
  stage: FlashcardStage;
  jobs: ExtractionJob[];
  genProgress: { done: number; total: number } | null;
  result: FlashcardBatchResult | null;
  error: string | null;
};

const initialState: DeckPipelineState = {
  stage: "idle",
  jobs: [],
  genProgress: null,
  result: null,
  error: null,
};

export function useDeckPipeline() {
  const [state, setState] = useState<DeckPipelineState>(initialState);
  const controllerRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);

  const run = useCallback(
    async (params: {
      images: StagedImage[];
      preferences: DeckPreferences;
      perImageOverrides?: PerImageOverride[];
      existingCards?: Array<{ front: string; back: string }>;
      deckId: string;
      enhance?: boolean;
    }) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const runId = ++runIdRef.current;

      const jobs: ExtractionJob[] = params.images.map((img) => ({
        imageId: img.id,
        fileName: img.file.name,
        status: "queued" as const,
        markdown: "",
        model: null,
        error: null,
        anchor: { imageId: img.id, startOffset: 0, endOffset: 0 },
      }));

      setState({
        stage: "extracting",
        jobs,
        genProgress: null,
        result: null,
        error: null,
      });

      try {
        const result = await runFlashcardBatchPipeline({
          images: params.images,
          preferences: params.preferences,
          perImageOverrides: params.perImageOverrides,
          existingCards: params.existingCards,
          deckId: params.deckId,
          signal: controller.signal,
          enhance: params.enhance,
          callbacks: {
            onExtractStart: (imageId) => {
              if (runId !== runIdRef.current) return;
              setState((prev) => ({
                ...prev,
                jobs: prev.jobs.map((j) =>
                  j.imageId === imageId ? { ...j, status: "extracting" } : j,
                ),
              }));
            },
            onExtractSuccess: (imageId, markdown, model) => {
              if (runId !== runIdRef.current) return;
              setState((prev) => ({
                ...prev,
                jobs: prev.jobs.map((j) =>
                  j.imageId === imageId
                    ? { ...j, status: "done", markdown, model }
                    : j,
                ),
              }));
            },
            onExtractError: (imageId, error) => {
              if (runId !== runIdRef.current) return;
              setState((prev) => ({
                ...prev,
                jobs: prev.jobs.map((j) =>
                  j.imageId === imageId ? { ...j, status: "failed", error } : j,
                ),
              }));
            },
            onDedupStart: () => {
              if (runId !== runIdRef.current) return;
              setState((prev) => ({ ...prev, stage: "deduping" }));
            },
            onReviewStart: () => {
              if (runId !== runIdRef.current) return;
              setState((prev) => ({ ...prev, stage: "reviewing" }));
            },
            onGenerateStart: () => {
              if (runId !== runIdRef.current) return;
              setState((prev) => ({
                ...prev,
                stage: "generating",
                genProgress: { done: 0, total: params.images.length },
              }));
            },
            onGenerateProgress: (done, total) => {
              if (runId !== runIdRef.current) return;
              setState((prev) => ({ ...prev, genProgress: { done, total } }));
            },
            onCardDedupStart: () => {
              if (runId !== runIdRef.current) return;
              setState((prev) => ({ ...prev, stage: "card-deduping" }));
            },
          },
        });

        if (controller.signal.aborted || runId !== runIdRef.current) return;

        setState((prev) => ({
          ...prev,
          stage: "completed",
          result,
          jobs: prev.jobs.map((j) =>
            j.status !== "failed" ? { ...j, status: "done" } : j,
          ),
        }));
      } catch (err) {
        if (controller.signal.aborted || runId !== runIdRef.current) return;
        setState((prev) => ({
          ...prev,
          stage: "failed",
          error: err instanceof Error ? err.message : "Unknown error",
        }));
      }
    },
    [],
  );

  const reset = useCallback(() => {
    runIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState(initialState);
  }, []);

  return { state, run, reset };
}

// Re-export for consumers.
export type { Card };
