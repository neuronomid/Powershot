import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const openRouterMocks = vi.hoisted(() => ({
  callFlashcardGen: vi.fn(),
}));

vi.mock("@/lib/ai/openrouter", () => ({
  callFlashcardGen: openRouterMocks.callFlashcardGen,
}));

import { POST, maxDuration, runtime } from "./route";

const ORIGINAL_API_KEY = process.env.OPENROUTER_API_KEY;

function request(body: unknown): Request {
  return new Request("http://localhost/api/flashcard/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/flashcard/generate", () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = "test-key";
    openRouterMocks.callFlashcardGen.mockReset();
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

  it("validates required markdown and style config before calling OpenRouter", async () => {
    const missingMarkdown = await POST(
      request({
        markdown: "",
        styles: [{ style: "basic-qa", count: 1 }],
      }),
    );
    expect(missingMarkdown.status).toBe(400);
    await expect(missingMarkdown.json()).resolves.toEqual({
      error: "markdown is required and must be a non-empty string",
    });

    const badStyles = await POST(
      request({
        markdown: "Alpha",
        styles: [{ style: "made-up", count: 1 }],
      }),
    );
    expect(badStyles.status).toBe(400);
    await expect(badStyles.json()).resolves.toEqual({
      error: "styles must be an array of {style, count} objects",
    });
    expect(openRouterMocks.callFlashcardGen).not.toHaveBeenCalled();
  });

  it("rejects over-large or negative style counts", async () => {
    for (const count of [-1, 21]) {
      const response = await POST(
        request({
          markdown: "Alpha",
          styles: [{ style: "basic-qa", count }],
        }),
      );
      expect(response.status).toBe(400);
    }
    expect(openRouterMocks.callFlashcardGen).not.toHaveBeenCalled();
  });

  it("requires the server-only OpenRouter key", async () => {
    delete process.env.OPENROUTER_API_KEY;

    const response = await POST(
      request({
        markdown: "Alpha",
        styles: [{ style: "basic-qa", count: 1 }],
      }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Server configuration error: OPENROUTER_API_KEY is not set.",
    });
    expect(openRouterMocks.callFlashcardGen).not.toHaveBeenCalled();
  });

  it("passes sanitized request config and ignores invented question tokens", async () => {
    openRouterMocks.callFlashcardGen.mockResolvedValue({
      cards: [
        {
          model: "basic",
          style: "basic-qa",
          difficulty: "medium",
          front: "Which pancreatic hormone is secreted after a meal?",
          back: "insulin",
          tags: ["endocrine"],
        },
      ],
    });

    const response = await POST(
      request({
        markdown: "Beta cells secrete insulin.",
        styles: [{ style: "basic-qa", count: 1.8 }],
        difficulty: "unknown",
        autoPick: false,
        instructions: "Skip pronunciation cards.",
      }),
    );

    expect(response.status).toBe(200);
    expect(openRouterMocks.callFlashcardGen).toHaveBeenCalledExactlyOnceWith({
      markdown: "Beta cells secrete insulin.",
      styles: [{ style: "basic-qa", count: 1 }],
      difficulty: "medium",
      autoPick: false,
      instructions: "Skip pronunciation cards.",
      apiKey: "test-key",
    });
    await expect(response.json()).resolves.toEqual({
      cards: [
        {
          model: "basic",
          style: "basic-qa",
          difficulty: "medium",
          front: "Which pancreatic hormone is secreted after a meal?",
          back: "insulin",
          tags: ["endocrine"],
        },
      ],
      guardrailViolations: [],
    });
  });

  it("returns soft answer-token guardrail warnings for basic cards", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    openRouterMocks.callFlashcardGen.mockResolvedValue({
      cards: [
        {
          model: "basic",
          style: "concept",
          difficulty: "medium",
          front: "Explain the endocrine role.",
          back: "insulin glucagon",
          extra: "pancreas",
        },
      ],
    });

    const response = await POST(
      request({
        markdown: "Beta cells secrete insulin.",
        styles: [{ style: "concept", count: 1 }],
        difficulty: "medium",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      guardrailViolations: ["glucagon", "pancreas"],
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "[api/flashcard/generate] Token-subset guardrail violations:",
      ["glucagon", "pancreas"],
    );
  });

  it("returns soft answer-token guardrail warnings for cloze spans", async () => {
    openRouterMocks.callFlashcardGen.mockResolvedValue({
      cards: [
        {
          model: "cloze",
          style: "cloze",
          difficulty: "easy",
          front: "The {{c1::heart}} pumps {{c1::oxygen}}.",
          back: "",
        },
      ],
    });

    const response = await POST(
      request({
        markdown: "The heart pumps blood.",
        styles: [{ style: "cloze", count: 1 }],
        difficulty: "easy",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      guardrailViolations: ["oxygen"],
    });
  });
});
