import { describe, expect, it } from "vitest";
import {
  runFidelityHarness,
  runFlashcardAnswerSubsetHarness,
  scoreFidelity,
} from "./fidelity-harness";

describe("scoreFidelity", () => {
  it("returns perfect scores for identical text", () => {
    const result = scoreFidelity("Hello world", "Hello world");
    expect(result.precision).toBe(1);
    expect(result.recall).toBe(1);
    expect(result.f1).toBe(1);
  });

  it("penalizes missing tokens", () => {
    const result = scoreFidelity("Hello world foo bar", "Hello world");
    expect(result.precision).toBe(1);
    expect(result.recall).toBeLessThan(1);
  });

  it("penalizes extra tokens", () => {
    const result = scoreFidelity("Hello world", "Hello world foo bar");
    expect(result.precision).toBeLessThan(1);
    expect(result.recall).toBe(1);
  });

  it("handles empty strings", () => {
    const result = scoreFidelity("", "");
    expect(result.f1).toBe(1);
  });
});

describe("runFidelityHarness", () => {
  it("computes averages across fixtures", () => {
    const results = runFidelityHarness([
      {
        id: "f1",
        name: "Exact match",
        referenceMarkdown: "alpha beta gamma",
        extractedMarkdown: "alpha beta gamma",
      },
      {
        id: "f2",
        name: "Partial match",
        referenceMarkdown: "alpha beta gamma",
        extractedMarkdown: "alpha beta",
      },
    ]);

    expect(results.results).toHaveLength(2);
    expect(results.averageF1).toBeGreaterThan(0);
    expect(results.averageF1).toBeLessThan(1);
  });
});

describe("runFlashcardAnswerSubsetHarness", () => {
  it("passes fixtures whose answers are source-token subsets", () => {
    const results = runFlashcardAnswerSubsetHarness([
      {
        id: "cards-1",
        name: "Valid flashcards",
        sourceMarkdown: "Beta cells secrete insulin.",
        cards: [
          {
            model: "basic",
            style: "basic-qa",
            difficulty: "medium",
            front: "Which hormone is secreted?",
            back: "insulin",
            tags: [],
          },
        ],
      },
    ]);

    expect(results.passed).toBe(true);
    expect(results.violationCount).toBe(0);
  });

  it("reports invented answer tokens without scoring question wording", () => {
    const results = runFlashcardAnswerSubsetHarness([
      {
        id: "cards-1",
        name: "Invalid flashcards",
        sourceMarkdown: "Beta cells secrete insulin.",
        cards: [
          {
            model: "basic",
            style: "basic-qa",
            difficulty: "medium",
            front: "Which pancreatic hormone is secreted?",
            back: "insulin glucagon",
            tags: [],
          },
        ],
      },
    ]);

    expect(results).toEqual({
      passed: false,
      violationCount: 1,
      results: [
        {
          fixtureId: "cards-1",
          passed: false,
          violationTokens: ["glucagon"],
        },
      ],
    });
  });
});
