import { describe, expect, it } from "vitest";

import { replaceChunkInNote } from "./chunk-utils";
import type { Note } from "./types";

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    title: "Test",
    createdAt: 0,
    updatedAt: 0,
    images: [],
    markdown: overrides.markdown ?? "",
    extractedMarkdown: overrides.extractedMarkdown ?? "",
    anchors: overrides.anchors ?? [],
    warnings: [],
    tokenSubsetViolations: null,
    preferences: {
      preset: "modern",
      bodyFont: "Inter",
      headingFont: "Inter",
      baseSize: "medium",
      lineSpacing: "1.5",
      pageSize: "us-letter",
      margins: "standard",
      includeToc: true,
      includeFooter: false,
    },
    chunks: [],
    ...overrides,
  };
}

describe("replaceChunkInNote", () => {
  it("replaces a chunk and shifts subsequent anchors", () => {
    const note = makeNote({
      markdown: "First chunk.\n\nSecond chunk.\n\nThird chunk.",
      extractedMarkdown: "First chunk.\n\nSecond chunk.\n\nThird chunk.",
      anchors: [
        { imageId: "img-1", startOffset: 0, endOffset: 12 },
        { imageId: "img-2", startOffset: 14, endOffset: 27 },
        { imageId: "img-3", startOffset: 29, endOffset: 40 },
      ],
    });

    const updated = replaceChunkInNote(note, "img-2", "Replaced chunk.");
    expect(updated).not.toBeNull();
    expect(updated!.markdown).toBe("First chunk.\n\nReplaced chunk.\n\nThird chunk.");
    expect(updated!.extractedMarkdown).toBe("First chunk.\n\nReplaced chunk.\n\nThird chunk.");
    expect(updated!.anchors).toEqual([
      { imageId: "img-1", startOffset: 0, endOffset: 12 },
      { imageId: "img-2", startOffset: 14, endOffset: 29 },
      { imageId: "img-3", startOffset: 31, endOffset: 42 },
    ]);
  });

  it("returns null when the image anchor is not found", () => {
    const note = makeNote({
      markdown: "Hello",
      extractedMarkdown: "Hello",
      anchors: [{ imageId: "img-1", startOffset: 0, endOffset: 5 }],
    });
    expect(replaceChunkInNote(note, "missing", "New")).toBeNull();
  });

  it("handles single-chunk notes", () => {
    const note = makeNote({
      markdown: "Old text",
      extractedMarkdown: "Old text",
      anchors: [{ imageId: "img-1", startOffset: 0, endOffset: 8 }],
    });
    const updated = replaceChunkInNote(note, "img-1", "New text");
    expect(updated!.markdown).toBe("New text");
    expect(updated!.anchors).toEqual([{ imageId: "img-1", startOffset: 0, endOffset: 8 }]);
  });
});
