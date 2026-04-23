import { describe, expect, it } from "vitest";
import { scoreFidelity, runFidelityHarness } from "./fidelity-harness";

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
