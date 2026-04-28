import { nanoid } from "nanoid";

import { runBatchPipeline } from "./batch";
import type { ChunkAnchor } from "./types";
import type { StagedImage } from "@/lib/upload/types";
import type {
  Card,
  Deck,
  DeckPreferences,
  Difficulty,
  FlashcardGenCandidate,
  PerImageOverride,
  StyleCount,
} from "@/lib/flashcard/types";
import { initialSM2State } from "@/lib/flashcard/types";
import { storeMediaFromCrop } from "@/lib/flashcard/media";

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
    if (running.size > 0) await Promise.race(running);
  }
}

export type FlashcardStage =
  | "idle"
  | "extracting"
  | "deduping"
  | "reviewing"
  | "generating"
  | "card-deduping"
  | "completed"
  | "failed";

export type FlashcardBatchCallbacks = {
  onExtractStart?: (imageId: string) => void;
  onExtractSuccess?: (imageId: string, markdown: string, model: string) => void;
  onExtractError?: (imageId: string, error: string) => void;
  onDedupStart?: () => void;
  onReviewStart?: (pre: string) => void;
  onReviewEnd?: () => void;
  onGenerateStart?: () => void;
  onGenerateProgress?: (doneImages: number, totalImages: number) => void;
  onCardDedupStart?: () => void;
};

export type FlashcardBatchInput = {
  images: StagedImage[];
  preferences: DeckPreferences;
  perImageOverrides?: PerImageOverride[];
  existingCards?: Array<{ front: string; back: string }>;
  deckId: string;
  signal?: AbortSignal;
  callbacks?: FlashcardBatchCallbacks;
  enhance?: boolean;
};

export type FlashcardGenerationInput = {
  images: StagedImage[];
  markdown: string;
  anchors: ChunkAnchor[];
  preferences: DeckPreferences;
  perImageOverrides?: PerImageOverride[];
  existingCards?: Array<{ front: string; back: string }>;
  deckId: string;
  signal?: AbortSignal;
  callbacks?: Pick<
    FlashcardBatchCallbacks,
    "onGenerateStart" | "onGenerateProgress" | "onCardDedupStart"
  >;
};

export type FlashcardBatchResult = {
  cards: Card[];
  dedupedAway: number;
  guardrailViolations: string[];
  extractedMarkdown: string;
  anchors: ChunkAnchor[];
};

function resolveImageConfig(
  imageId: string,
  prefs: DeckPreferences,
  overrides: PerImageOverride[] | undefined,
): {
  styles: StyleCount[];
  difficulty: Difficulty;
  autoPick: boolean;
  instructions: string;
} {
  const o = overrides?.find((x) => x.imageId === imageId);
  return {
    styles: o?.styles ?? prefs.styles,
    difficulty: o?.difficulty ?? prefs.difficulty,
    autoPick: prefs.styleAutoPick,
    instructions: prefs.generationInstructions,
  };
}

function chunkForImage(
  markdown: string,
  anchors: ChunkAnchor[],
  imageId: string,
): string {
  const a = anchors.find((x) => x.imageId === imageId);
  if (!a) return "";
  return markdown.slice(a.startOffset, a.endOffset);
}

function candidateToCard(
  c: FlashcardGenCandidate,
  sourceImageId: string | undefined,
  sourceImageIndex: number | undefined,
  mediaId: string | undefined,
  guardrailViolations: string[] | undefined,
  now: number,
): Card {
  const tags = [
    `style:${c.style}`,
    `difficulty:${c.difficulty}`,
    ...(c.tags ?? []),
  ];
  return {
    id: nanoid(10),
    model: c.model,
    style: c.style,
    difficulty: c.difficulty,
    front: c.front,
    back: c.back,
    extra: c.extra,
    mediaRefs: mediaId
      ? [{ mediaId, role: c.mediaRole === "back" ? "back" : "front" }]
      : undefined,
    sourceImageId,
    sourceImageIndex,
    tags,
    scheduler: initialSM2State(now),
    createdAt: now,
    updatedAt: now,
    guardrailViolations:
      guardrailViolations && guardrailViolations.length > 0
        ? guardrailViolations
        : undefined,
  };
}

export async function runFlashcardBatchPipeline(
  input: FlashcardBatchInput,
): Promise<FlashcardBatchResult> {
  const {
    images,
    preferences,
    perImageOverrides,
    existingCards,
    deckId,
    signal,
    callbacks,
    enhance,
  } = input;

  // ─── Phase A: Extract + deterministic dedup + semantic dedup + review (shared) ───
  const extractionResult = await runBatchPipeline(images, {
    signal,
    enhance,
    callbacks: {
      onExtractStart: callbacks?.onExtractStart,
      onExtractSuccess: callbacks?.onExtractSuccess,
      onExtractError: callbacks?.onExtractError,
      onDedupStart: callbacks?.onDedupStart,
      onReviewStart: callbacks?.onReviewStart,
      onReviewEnd: callbacks?.onReviewEnd,
    },
  });

  return runFlashcardGenerationFromExtraction({
    images,
    markdown: extractionResult.markdown,
    anchors: extractionResult.anchors,
    preferences,
    perImageOverrides,
    existingCards,
    deckId,
    signal,
    callbacks,
  });
}

export async function runFlashcardGenerationFromExtraction(
  input: FlashcardGenerationInput,
): Promise<FlashcardBatchResult> {
  const {
    images,
    markdown,
    anchors,
    preferences,
    perImageOverrides,
    existingCards,
    deckId,
    signal,
    callbacks,
  } = input;

  const now = Date.now();

  // ─── Phase B: Per-image flashcard generation ───
  callbacks?.onGenerateStart?.();

  type PerImageCards = {
    imageId: string;
    imageIndex: number;
    candidates: FlashcardGenCandidate[];
    guardrailViolations: string[];
  };
  const allPerImage: PerImageCards[] = [];
  let completedImages = 0;

  const imagesToProcess = images
    .map((img, idx) => ({ img, idx }))
    .filter(({ img }) => {
      const chunk = chunkForImage(markdown, anchors, img.id);
      return chunk.trim().length > 0;
    });

  await runWithConcurrency(imagesToProcess, 4, async ({ img, idx }) => {
    if (signal?.aborted) return;
    const chunk = chunkForImage(markdown, anchors, img.id);
    if (!chunk.trim()) {
      completedImages++;
      callbacks?.onGenerateProgress?.(completedImages, imagesToProcess.length);
      return;
    }
    const cfg = resolveImageConfig(img.id, preferences, perImageOverrides);
    if (cfg.styles.length === 0 || cfg.styles.every((s) => s.count === 0)) {
      completedImages++;
      callbacks?.onGenerateProgress?.(completedImages, imagesToProcess.length);
      return;
    }

    try {
      const res = await fetch("/api/flashcard/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          markdown: chunk,
          styles: cfg.styles,
          difficulty: cfg.difficulty,
          autoPick: cfg.autoPick,
          instructions: cfg.instructions,
        }),
      });
      if (signal?.aborted) return;
      if (!res.ok) {
        console.error(`[flashcard-batch] gen HTTP ${res.status} for image ${img.id}`);
        return;
      }
      const data = (await res.json()) as {
        cards: FlashcardGenCandidate[];
        guardrailViolations?: string[];
      };
      allPerImage.push({
        imageId: img.id,
        imageIndex: idx,
        candidates: data.cards ?? [],
        guardrailViolations: data.guardrailViolations ?? [],
      });
    } catch (err) {
      if (signal?.aborted) return;
      console.error(`[flashcard-batch] gen failed for image ${img.id}:`, err);
    } finally {
      completedImages++;
      callbacks?.onGenerateProgress?.(completedImages, imagesToProcess.length);
    }
  });

  if (signal?.aborted) throw new Error("Aborted");

  // Flatten, keeping stable order by image index.
  allPerImage.sort((a, b) => a.imageIndex - b.imageIndex);
  const flatCandidates: Array<{
    candidate: FlashcardGenCandidate;
    imageId: string;
    imageIndex: number;
    guardrailViolations: string[];
  }> = [];
  for (const p of allPerImage) {
    for (const c of p.candidates) {
      flatCandidates.push({
        candidate: c,
        imageId: p.imageId,
        imageIndex: p.imageIndex,
        guardrailViolations: p.guardrailViolations,
      });
    }
  }

  // ─── Phase C: Card dedup against existing deck ───
  let duplicateSet = new Set<number>();
  if (existingCards && existingCards.length > 0 && flatCandidates.length > 0) {
    callbacks?.onCardDedupStart?.();
    try {
      const pairs = flatCandidates.map((fc, i) => ({
        candidateIndex: i,
        candidateText: `${fc.candidate.front}\n---\n${fc.candidate.back}`,
        existingTexts: existingCards.map((e) => `${e.front}\n---\n${e.back}`),
      }));
      const res = await fetch("/api/flashcard/dedup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({ pairs }),
      });
      if (res.ok) {
        const data = (await res.json()) as { duplicateIndices: number[] };
        duplicateSet = new Set(data.duplicateIndices ?? []);
      }
    } catch (err) {
      if (signal?.aborted) throw new Error("Aborted");
      console.error("[flashcard-batch] dedup failed:", err);
    }
  }

  // ─── Phase D: Image media capture for diagram-style cards ───
  const cards: Card[] = [];
  const violations: string[] = [];
  for (let i = 0; i < flatCandidates.length; i++) {
    if (duplicateSet.has(i)) continue;
    const { candidate, imageId, imageIndex, guardrailViolations } = flatCandidates[i]!;
    for (const token of guardrailViolations) violations.push(token);
    let mediaId: string | undefined;

    if (candidate.style === "diagram" || candidate.mediaCrop) {
      const img = images[imageIndex];
      if (img?.previewUrl || img?.objectUrl) {
        try {
          mediaId = await storeMediaFromCrop({
            deckId,
            sourceImageUrl: img.previewUrl || img.objectUrl,
            crop: candidate.mediaCrop,
            filenameHint: img.file.name,
          });
        } catch (err) {
          console.error("[flashcard-batch] media capture failed:", err);
        }
      }
    }

    cards.push(
      candidateToCard(
        candidate,
        imageId,
        imageIndex,
        mediaId,
        guardrailViolations,
        now,
      ),
    );
  }

  return {
    cards,
    dedupedAway: duplicateSet.size,
    guardrailViolations: violations,
    extractedMarkdown: markdown,
    anchors,
  };
}

export type DeckPipelineOutput = {
  deck: Deck;
  result: FlashcardBatchResult;
};
