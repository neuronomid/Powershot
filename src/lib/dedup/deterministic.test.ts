import { describe, expect, it } from "vitest";

import { dedupAdjacentChunks, dedupChunkList } from "./deterministic";

describe("dedupAdjacentChunks", () => {
  it("returns unchanged when there is no overlap", () => {
    const a = "Hello world";
    const b = "Something else entirely";
    const result = dedupAdjacentChunks(a, b);
    expect(result.cleanedA).toBe(a);
    expect(result.cleanedB).toBe(b);
  });

  it("removes overlap when it spans >= 2 full lines", () => {
    const a = "Header\n\nParagraph one.\nParagraph two.";
    const b = "Paragraph one.\nParagraph two.\nParagraph three.";
    const result = dedupAdjacentChunks(a, b);
    expect(result.cleanedA).toBe(a);
    expect(result.cleanedB).toBe("\nParagraph three.");
  });

  it("removes overlap when normalized chars >= 60", () => {
    const overlap = "a".repeat(60);
    const a = `start ${overlap}`;
    const b = `${overlap} end`;
    const result = dedupAdjacentChunks(a, b);
    expect(result.cleanedA).toBe(a);
    expect(result.cleanedB).toBe(" end");
  });

  it("does NOT remove short single-line overlaps", () => {
    const a = "Hello World";
    const b = "hello world something";
    const result = dedupAdjacentChunks(a, b);
    expect(result.cleanedA).toBe(a);
    expect(result.cleanedB).toBe(b);
  });

  it("is case-insensitive for large overlaps", () => {
    const overlap = "x".repeat(60);
    const a = `start ${overlap.toUpperCase()}`;
    const b = `${overlap.toLowerCase()} end`;
    const result = dedupAdjacentChunks(a, b);
    expect(result.cleanedA).toBe(a);
    expect(result.cleanedB).toBe(" end");
  });

  it("ignores whitespace differences for large overlaps", () => {
    const overlap = "word".repeat(15); // 60 chars
    const a = `start ${overlap}`;
    const b = `${overlap.replace(/ /g, "\n")} end`;
    const result = dedupAdjacentChunks(a, b);
    expect(result.cleanedA).toBe(a);
    expect(result.cleanedB).toBe(" end");
  });
});

describe("dedupChunkList", () => {
  it("returns empty array for empty input", () => {
    expect(dedupChunkList([])).toEqual([]);
  });

  it("returns single chunk unchanged", () => {
    expect(dedupChunkList(["only one"])).toEqual(["only one"]);
  });

  it("processes a list of chunks left-to-right", () => {
    const chunks = [
      "Line one.\nLine two.\nLine three.",
      "Line two.\nLine three.\nLine four.",
      "Line two.\nLine three.\nLine four.\nLine five.",
    ];
    const result = dedupChunkList(chunks);
    expect(result[0]).toBe(chunks[0]);
    // overlap between 0 and 1 is 2 lines -> removed from 1
    expect(result[1]).toBe("\nLine four.");
    // result[1] = "\nLine four.", chunks[2] starts with "Line two." -> no overlap
    expect(result[2]).toBe(chunks[2]);
  });
});
