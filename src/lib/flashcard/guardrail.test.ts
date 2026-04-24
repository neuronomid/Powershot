import { describe, expect, it } from "vitest";

import {
  answerTextForGuardrail,
  extractWordTokens,
  findAnswerTokenSubsetViolations,
} from "./guardrail";
import type { FlashcardGenCandidate } from "./types";

function card(overrides: Partial<FlashcardGenCandidate>): FlashcardGenCandidate {
  return {
    model: "basic",
    style: "basic-qa",
    difficulty: "medium",
    front: "What is secreted?",
    back: "insulin",
    ...overrides,
  };
}

describe("flashcard answer guardrail", () => {
  it("normalizes word tokens case-insensitively and strips punctuation", () => {
    expect([...extractWordTokens("Beta-cells secrete INSULIN, 24/7.")]).toEqual([
      "beta",
      "cells",
      "secrete",
      "insulin",
      "24",
      "7",
    ]);
  });

  it("checks only answer-side text for basic cards", () => {
    const violations = findAnswerTokenSubsetViolations({
      sourceMarkdown: "Beta cells secrete insulin.",
      cards: [
        card({
          front: "Which pancreatic hormone is secreted after a meal?",
          back: "insulin",
        }),
      ],
    });

    expect(violations).toEqual([]);
  });

  it("checks basic card back and extra fields against the source", () => {
    const violations = findAnswerTokenSubsetViolations({
      sourceMarkdown: "Beta cells secrete insulin.",
      cards: [
        card({
          back: "insulin glucagon",
          extra: "pancreas",
        }),
      ],
    });

    expect(violations).toEqual(["glucagon", "pancreas"]);
  });

  it("checks only concealed cloze spans, including hints", () => {
    const cloze = card({
      model: "cloze",
      style: "cloze",
      front: "The {{c1::heart::organ}} pumps {{c1::oxygen}}.",
      back: "",
    });

    expect(answerTextForGuardrail(cloze)).toBe("heart oxygen");
    expect(
      findAnswerTokenSubsetViolations({
        sourceMarkdown: "The heart pumps blood.",
        cards: [cloze],
      }),
    ).toEqual(["oxygen"]);
  });

  it("deduplicates repeated violation tokens across cards", () => {
    expect(
      findAnswerTokenSubsetViolations({
        sourceMarkdown: "Alpha beta",
        cards: [
          card({ back: "gamma" }),
          card({ back: "gamma delta" }),
        ],
      }),
    ).toEqual(["gamma", "delta"]);
  });
});
