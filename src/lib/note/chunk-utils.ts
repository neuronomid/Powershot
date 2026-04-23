import type { Note } from "./types";

/**
 * Replace a single chunk's Markdown in a note after re-extraction.
 * Uses the chunk anchors to locate the text segment. Falls back to
 * searching for the old chunk text in extractedMarkdown.
 */
export function replaceChunkInNote(
  note: Note,
  imageId: string,
  newChunkMarkdown: string,
): Note | null {
  const anchor = note.anchors.find((a) => a.imageId === imageId);
  if (!anchor) return null;

  const oldChunk = note.extractedMarkdown.slice(anchor.startOffset, anchor.endOffset);
  if (!oldChunk) return null;

  const lengthDiff = newChunkMarkdown.length - oldChunk.length;

  // Replace in both markdown and extractedMarkdown
  const replaceInString = (str: string): string => {
    const idx = str.indexOf(oldChunk);
    if (idx === -1) return str;
    return str.slice(0, idx) + newChunkMarkdown + str.slice(idx + oldChunk.length);
  };

  const newMarkdown = replaceInString(note.markdown);
  const newExtracted = replaceInString(note.extractedMarkdown);

  // Shift anchors after this one
  const newAnchors = note.anchors.map((a) => {
    if (a.startOffset < anchor.startOffset) return a;
    if (a.imageId === imageId) {
      return {
        ...a,
        endOffset: a.endOffset + lengthDiff,
      };
    }
    return {
      ...a,
      startOffset: a.startOffset + lengthDiff,
      endOffset: a.endOffset + lengthDiff,
    };
  });

  return {
    ...note,
    markdown: newMarkdown,
    extractedMarkdown: newExtracted,
    anchors: newAnchors,
    updatedAt: Date.now(),
  };
}
