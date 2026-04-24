import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StagedImage } from "@/lib/upload/types";
import type { DeckPreferences } from "@/lib/flashcard/types";

const batchMocks = vi.hoisted(() => ({
  runBatchPipeline: vi.fn(),
}));

const mediaMocks = vi.hoisted(() => ({
  storeMediaFromCrop: vi.fn(),
}));

const nanoidMock = vi.hoisted(() => ({
  counter: 0,
  nanoid: vi.fn(() => `card-${++nanoidMock.counter}`),
}));

vi.mock("./batch", () => ({
  runBatchPipeline: batchMocks.runBatchPipeline,
}));

vi.mock("@/lib/flashcard/media", () => ({
  storeMediaFromCrop: mediaMocks.storeMediaFromCrop,
}));

vi.mock("nanoid", () => ({
  nanoid: nanoidMock.nanoid,
}));

import { runFlashcardBatchPipeline } from "./flashcard-batch";

const NOW = 1_700_000_000_000;

function image(id: string, name = `${id}.png`): StagedImage {
  return {
    id,
    file: new File(["image"], name, { type: "image/png" }),
    objectUrl: `blob:${id}`,
    previewUrl: `preview:${id}`,
    detectedAt: null,
    timestampSource: "insertion",
  };
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json" },
  });
}

const preferences: DeckPreferences = {
  styles: [{ style: "basic-qa", count: 1 }],
  difficulty: "medium",
  styleAutoPick: true,
};

describe("runFlashcardBatchPipeline", () => {
  beforeEach(() => {
    batchMocks.runBatchPipeline.mockReset();
    mediaMocks.storeMediaFromCrop.mockReset();
    nanoidMock.counter = 0;
    vi.spyOn(Date, "now").mockReturnValue(NOW);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("generates cards per reviewed image chunk, preserves order, and surfaces guardrail warnings", async () => {
    batchMocks.runBatchPipeline.mockResolvedValue({
      markdown: "Alpha source\n\nBeta source",
      warnings: [],
      tokenSubsetViolations: null,
      anchors: [
        { imageId: "one", startOffset: 0, endOffset: 12 },
        { imageId: "two", startOffset: 14, endOffset: 25 },
      ],
    });

    const requestBodies: Array<Record<string, unknown>> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const body =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : {};
      requestBodies.push(body);

      if (url !== "/api/flashcard/generate") {
        throw new Error(`Unexpected fetch to ${url}`);
      }

      if (body.markdown === "Alpha source") {
        return jsonResponse({
          cards: [
            {
              model: "basic",
              style: "basic-qa",
              difficulty: "medium",
              front: "Alpha front",
              back: "Alpha source",
              tags: ["lecture"],
            },
          ],
          guardrailViolations: ["invented"],
        });
      }

      return jsonResponse({
        cards: [
          {
            model: "cloze",
            style: "cloze",
            difficulty: "challenging",
            front: "{{c1::Beta}} source",
            back: "",
          },
        ],
        guardrailViolations: [],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runFlashcardBatchPipeline({
      images: [image("one"), image("two")],
      preferences,
      perImageOverrides: [
        {
          imageId: "two",
          styles: [{ style: "cloze", count: 2 }],
          difficulty: "challenging",
        },
      ],
      deckId: "deck-1",
    });

    expect(batchMocks.runBatchPipeline).toHaveBeenCalledOnce();
    expect(requestBodies).toEqual([
      {
        markdown: "Alpha source",
        styles: [{ style: "basic-qa", count: 1 }],
        difficulty: "medium",
        autoPick: true,
      },
      {
        markdown: "Beta source",
        styles: [{ style: "cloze", count: 2 }],
        difficulty: "challenging",
        autoPick: true,
      },
    ]);
    expect(result.cards.map((c) => c.front)).toEqual([
      "Alpha front",
      "{{c1::Beta}} source",
    ]);
    expect(result.cards[0]).toMatchObject({
      id: "card-1",
      sourceImageId: "one",
      sourceImageIndex: 0,
      tags: ["style:basic-qa", "difficulty:medium", "lecture"],
      guardrailViolations: ["invented"],
      scheduler: {
        ease: 2.5,
        intervalDays: 0,
        repetitions: 0,
        dueAt: NOW,
      },
    });
    expect(result.cards[1]).toMatchObject({
      id: "card-2",
      sourceImageId: "two",
      sourceImageIndex: 1,
      guardrailViolations: undefined,
    });
    expect(result.guardrailViolations).toEqual(["invented"]);
    expect(result.extractedMarkdown).toBe("Alpha source\n\nBeta source");
  });

  it("dedups against existing deck cards and captures media for surviving diagram cards", async () => {
    batchMocks.runBatchPipeline.mockResolvedValue({
      markdown: "Diagram source",
      warnings: [],
      tokenSubsetViolations: null,
      anchors: [{ imageId: "one", startOffset: 0, endOffset: 14 }],
    });
    mediaMocks.storeMediaFromCrop.mockResolvedValue("deck-1_media.jpg");

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      const body =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as Record<string, unknown>)
          : {};

      if (url === "/api/flashcard/generate") {
        expect(body.markdown).toBe("Diagram source");
        return jsonResponse({
          cards: [
            {
              model: "basic",
              style: "basic-qa",
              difficulty: "medium",
              front: "Duplicate front",
              back: "Duplicate back",
            },
            {
              model: "basic",
              style: "diagram",
              difficulty: "medium",
              front: "Identify the labeled structure.",
              back: "Diagram source",
              mediaCrop: { x: 5, y: 6, width: 40, height: 30 },
              mediaRole: "front",
            },
          ],
          guardrailViolations: [],
        });
      }

      if (url === "/api/flashcard/dedup") {
        expect(body).toEqual({
          pairs: [
            {
              candidateIndex: 0,
              candidateText: "Duplicate front\n---\nDuplicate back",
              existingTexts: ["Duplicate front\n---\nDuplicate back"],
            },
            {
              candidateIndex: 1,
              candidateText: "Identify the labeled structure.\n---\nDiagram source",
              existingTexts: ["Duplicate front\n---\nDuplicate back"],
            },
          ],
        });
        return jsonResponse({ duplicateIndices: [0] });
      }

      throw new Error(`Unexpected fetch to ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await runFlashcardBatchPipeline({
      images: [image("one", "diagram.png")],
      preferences,
      existingCards: [{ front: "Duplicate front", back: "Duplicate back" }],
      deckId: "deck-1",
    });

    expect(result.dedupedAway).toBe(1);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({
      style: "diagram",
      mediaRefs: [{ mediaId: "deck-1_media.jpg", role: "front" }],
    });
    expect(mediaMocks.storeMediaFromCrop).toHaveBeenCalledExactlyOnceWith({
      deckId: "deck-1",
      sourceImageUrl: "preview:one",
      crop: { x: 5, y: 6, width: 40, height: 30 },
      filenameHint: "diagram.png",
    });
  });

  it("skips flashcard generation when all requested style counts are zero", async () => {
    batchMocks.runBatchPipeline.mockResolvedValue({
      markdown: "Alpha source",
      warnings: [],
      tokenSubsetViolations: null,
      anchors: [{ imageId: "one", startOffset: 0, endOffset: 12 }],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await runFlashcardBatchPipeline({
      images: [image("one")],
      preferences: {
        ...preferences,
        styles: [{ style: "basic-qa", count: 0 }],
      },
      existingCards: [{ front: "Existing", back: "Existing" }],
      deckId: "deck-1",
    });

    expect(result.cards).toEqual([]);
    expect(result.dedupedAway).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
