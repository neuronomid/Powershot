import { describe, expect, it } from "vitest";

import { computeReviewChanges } from "./review-diff";

describe("computeReviewChanges", () => {
  it("returns no changes for identical strings", () => {
    const result = computeReviewChanges("Hello world", "Hello world");
    expect(result.hasChanges).toBe(false);
    expect(result.removed).toHaveLength(0);
    expect(result.reordered).toHaveLength(0);
  });

  it("returns no changes for empty strings", () => {
    const result = computeReviewChanges("", "");
    expect(result.hasChanges).toBe(false);
  });

  it("detects removed passages", () => {
    const before = "First paragraph\n\nSecond paragraph\n\nThird paragraph";
    const after = "First paragraph\n\nThird paragraph";
    const result = computeReviewChanges(before, after);
    expect(result.hasChanges).toBe(true);
    expect(result.removed.length).toBeGreaterThanOrEqual(1);
  });

  it("ignores very short hunks", () => {
    const before = "ab";
    const after = "a";
    const result = computeReviewChanges(before, after);
    expect(result.removed).toHaveLength(0);
  });

  it("detects heading reorder", () => {
    const intro = "Introduction text that provides enough content to create separation between the sections.";
    const methods = "Methods text describing the experimental approach in sufficient detail for reproduction.";
    const results = "Results text summarizing the key findings and statistical outcomes of the study.";
    const before = `# Introduction\n\n${intro}\n\n## Methods\n\n${methods}\n\n## Results\n\n${results}`;
    const after = `# Introduction\n\n${intro}\n\n## Results\n\n${results}\n\n## Methods\n\n${methods}`;
    const result = computeReviewChanges(before, after);
    expect(result.hasChanges).toBe(true);
    expect(result.reordered.length).toBeGreaterThanOrEqual(1);
  });

  it("returns no changes when review only adds whitespace", () => {
    const before = "Hello";
    const after = "Hello\n";
    const result = computeReviewChanges(before, after);
    expect(result.hasChanges).toBe(false);
  });

  it("truncates long removed passages", () => {
    const longText = "a".repeat(200);
    const before = longText;
    const after = "short";
    const result = computeReviewChanges(before, after);
    for (const item of result.removed) {
      expect(item.text.length).toBeLessThanOrEqual(123);
    }
  });

  it("tags deduplicated paragraphs", () => {
    const paragraph = "This is a unique paragraph that appears in the document with some meaningful content.";
    const before = `${paragraph}\n\n${paragraph}`;
    const after = paragraph;
    const result = computeReviewChanges(before, after);
    expect(result.removed.some((r) => r.tag === "dedup")).toBe(true);
  });
});