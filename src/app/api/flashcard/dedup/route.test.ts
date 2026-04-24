import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openRouterMocks = vi.hoisted(() => ({
  callFlashcardDedup: vi.fn(),
}));

vi.mock("@/lib/ai/openrouter", () => ({
  callFlashcardDedup: openRouterMocks.callFlashcardDedup,
}));

import { POST, maxDuration, runtime } from "./route";

const ORIGINAL_API_KEY = process.env.OPENROUTER_API_KEY;

function request(body: unknown): Request {
  return new Request("http://localhost/api/flashcard/dedup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/flashcard/dedup", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    openRouterMocks.callFlashcardDedup.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (ORIGINAL_API_KEY === undefined) {
      delete process.env.OPENROUTER_API_KEY;
    } else {
      process.env.OPENROUTER_API_KEY = ORIGINAL_API_KEY;
    }
  });

  it("declares the Node runtime and 60 second duration from Plan3", () => {
    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(60);
  });

  it("validates the deletion-index pair contract", async () => {
    const response = await POST(
      request({
        pairs: [{ candidateIndex: "0", candidateText: "front", existingTexts: [] }],
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error:
        "pairs must be an array of {candidateIndex, candidateText, existingTexts}",
    });
    expect(openRouterMocks.callFlashcardDedup).not.toHaveBeenCalled();
  });

  it("returns no duplicates without OpenRouter when there is nothing to compare", async () => {
    delete process.env.OPENROUTER_API_KEY;

    const emptyPairs = await POST(request({ pairs: [] }));
    expect(emptyPairs.status).toBe(200);
    await expect(emptyPairs.json()).resolves.toEqual({ duplicateIndices: [] });

    const noExistingCards = await POST(
      request({
        pairs: [
          {
            candidateIndex: 0,
            candidateText: "What is ATP?\n---\nATP",
            existingTexts: [],
          },
        ],
      }),
    );
    expect(noExistingCards.status).toBe(200);
    await expect(noExistingCards.json()).resolves.toEqual({
      duplicateIndices: [],
    });
    expect(openRouterMocks.callFlashcardDedup).not.toHaveBeenCalled();
  });

  it("requires the server-only OpenRouter key when semantic comparison is needed", async () => {
    delete process.env.OPENROUTER_API_KEY;

    const response = await POST(
      request({
        pairs: [
          {
            candidateIndex: 0,
            candidateText: "What is ATP?\n---\nATP",
            existingTexts: ["Define ATP\n---\nATP"],
          },
        ],
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Server configuration error: OPENROUTER_API_KEY is not set.",
    });
    expect(openRouterMocks.callFlashcardDedup).not.toHaveBeenCalled();
  });

  it("delegates semantic duplicate detection and returns deletion indices only", async () => {
    const pairs = [
      {
        candidateIndex: 0,
        candidateText: "What is ATP?\n---\nATP",
        existingTexts: ["Define ATP\n---\nATP"],
      },
      {
        candidateIndex: 1,
        candidateText: "What is NADH?\n---\nNADH",
        existingTexts: ["Define ATP\n---\nATP"],
      },
    ];
    openRouterMocks.callFlashcardDedup.mockResolvedValue({
      duplicateIndices: [0],
    });

    const response = await POST(request({ pairs }));

    expect(response.status).toBe(200);
    expect(openRouterMocks.callFlashcardDedup).toHaveBeenCalledExactlyOnceWith({
      pairs,
      apiKey: "test-key",
    });
    await expect(response.json()).resolves.toEqual({ duplicateIndices: [0] });
  });
});
