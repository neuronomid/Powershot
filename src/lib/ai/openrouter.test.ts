import { afterEach, describe, expect, it, vi } from "vitest";

import {
  callFlashcardDedup,
  callFlashcardGen,
  FLASH_MODEL,
} from "./openrouter";

function openRouterResponse(content: string, init: ResponseInit = {}) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { role: "assistant", content } }],
    }),
    {
      status: init.status ?? 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>) {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  return JSON.parse(String(init?.body));
}

describe("OpenRouter flashcard calls", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends flashcard generation requests to Flash and parses fenced JSON", async () => {
    const fetchMock = vi.fn(async () =>
      openRouterResponse(`\`\`\`json
{
  "cards": [
    {
      "model": "basic",
      "style": "basic-qa",
      "difficulty": "challenging",
      "front": "What does ATP synthase produce?",
      "back": "ATP",
      "extra": "ATP synthase",
      "tags": ["cell-bio", 42]
    }
  ]
}
\`\`\``),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callFlashcardGen({
      markdown: "ATP synthase produces ATP.",
      styles: [{ style: "basic-qa", count: 1 }],
      difficulty: "challenging",
      autoPick: false,
      apiKey: "test-key",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = requestBody(fetchMock);
    expect(body.model).toBe(FLASH_MODEL);
    expect(body.temperature).toBe(0.2);
    expect(body.messages[0].content).toContain("Every answer");
    expect(body.messages[1].content[0].text).toContain(
      '"style":"basic-qa","count":1',
    );
    expect(body.messages[1].content[0].text).toContain(
      "SOURCE:\nATP synthase produces ATP.",
    );
    expect(result.cards).toEqual([
      {
        model: "basic",
        style: "basic-qa",
        difficulty: "challenging",
        front: "What does ATP synthase produce?",
        back: "ATP",
        extra: "ATP synthase",
        tags: ["cell-bio"],
      },
    ]);
  });

  it("rejects malformed flashcard generation JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => openRouterResponse("not json")));

    await expect(
      callFlashcardGen({
        markdown: "Alpha",
        styles: [{ style: "basic-qa", count: 1 }],
        difficulty: "medium",
        autoPick: true,
        apiKey: "test-key",
      }),
    ).rejects.toThrow();
  });

  it("skips the network for empty flashcard dedup batches", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callFlashcardDedup({ pairs: [], apiKey: "test-key" }),
    ).resolves.toEqual({ duplicateIndices: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends flashcard dedup requests and keeps only numeric duplicate indices", async () => {
    const fetchMock = vi.fn(async () =>
      openRouterResponse(`{"duplicateIndices":[0,"bad",3]}`),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callFlashcardDedup({
      apiKey: "test-key",
      pairs: [
        {
          candidateIndex: 0,
          candidateText: "What is ATP?---ATP",
          existingTexts: ["Define ATP---ATP"],
        },
      ],
    });

    expect(result).toEqual({ duplicateIndices: [0, 3] });
    const body = requestBody(fetchMock);
    expect(body.model).toBe(FLASH_MODEL);
    expect(body.temperature).toBe(0.1);
    expect(body.messages[0].content).toContain("semantic duplicates");
    expect(body.messages[1].content[0].text).toContain("candidateIndex");
  });
});
