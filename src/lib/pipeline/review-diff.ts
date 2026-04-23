import diff from "fast-diff";
import type { RemovedPassage, ReorderedBlock, ReviewChangeSummary } from "./types";

const MIN_HUNK_LENGTH = 3;
const REORDER_THRESHOLD_CHARS = 50;

function extractHeadingAnchors(markdown: string): Map<string, number> {
  const anchors = new Map<string, number>();
  const lines = markdown.split("\n");
  let position = 0;
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (/^#{1,3}\s/.test(trimmed) && trimmed.length <= 120) {
      const heading = trimmed.replace(/^#+\s*/, "").trim();
      if (heading.length > 0 && !anchors.has(heading)) {
        anchors.set(heading, position);
      }
    }
    position += line.length + 1;
  }
  return anchors;
}

export function computeReviewChanges(
  before: string,
  after: string,
): ReviewChangeSummary {
  if (!before || !after) {
    return { removed: [], reordered: [], hasChanges: false };
  }

  if (before === after) {
    return { removed: [], reordered: [], hasChanges: false };
  }

  const changes = diff(before, after);

  const removedHunks: string[] = [];
  const addedHunks: string[] = [];

  for (const [op, text] of changes) {
    const trimmed = text.trim();
    if (op === diff.DELETE && trimmed.length >= MIN_HUNK_LENGTH) {
      removedHunks.push(trimmed.length > 120 ? trimmed.slice(0, 117) + "…" : trimmed);
    } else if (op === diff.INSERT && trimmed.length >= MIN_HUNK_LENGTH) {
      addedHunks.push(trimmed);
    }
  }

  const beforeParagraphs: string[] = before
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= MIN_HUNK_LENGTH);

  const afterParagraphs: string[] = after
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length >= MIN_HUNK_LENGTH);

  const afterCount = new Map<string, number>();
  for (const p of afterParagraphs) {
    afterCount.set(p, (afterCount.get(p) ?? 0) + 1);
  }

  const beforeUsed = new Map<string, number>();
  const dedupRemoved: RemovedPassage[] = [];

  for (const item of removedHunks) {
    let bestMatch: string | null = null;
    let bestRatio = 0;

    for (const added of addedHunks) {
      if (added.length < MIN_HUNK_LENGTH) continue;
      const shorter = Math.min(item.length, added.length);
      const longer = Math.max(item.length, added.length);
      if (shorter > 20 && shorter / longer > 0.85) {
        const ratio = shorter / longer;
        if (ratio > bestRatio) {
          bestRatio = ratio;
          bestMatch = added;
        }
      }
    }

    if (bestMatch) {
      dedupRemoved.push({ text: item, tag: "dedup" });
    } else {
      // Check if this removed text corresponds to a full paragraph that appeared
      // more times in before than in after (classic dedup removal)
      const matchingParagraph = beforeParagraphs.find(
        (p) => p.includes(item) || item.includes(p),
      );
      if (matchingParagraph) {
        const beforeOccurrences = beforeParagraphs.filter(
          (p) => p === matchingParagraph,
        ).length;
        const afterOccurrences = afterCount.get(matchingParagraph) ?? 0;
        const used = beforeUsed.get(matchingParagraph) ?? 0;

        if (beforeOccurrences > afterOccurrences + used) {
          dedupRemoved.push({ text: item, tag: "dedup" });
          beforeUsed.set(matchingParagraph, used + 1);
        } else {
          dedupRemoved.push({ text: item, tag: "other" });
        }
      } else {
        dedupRemoved.push({ text: item, tag: "other" });
      }
    }
  }

  const beforeHeadings = extractHeadingAnchors(before);
  const afterHeadings = extractHeadingAnchors(after);

  const reordered: ReorderedBlock[] = [];
  for (const [heading, beforePos] of beforeHeadings) {
    const afterPos = afterHeadings.get(heading);
    if (
      afterPos !== undefined &&
      Math.abs(beforePos - afterPos) > REORDER_THRESHOLD_CHARS
    ) {
      reordered.push({
        heading,
        fromPosition: beforePos,
        toPosition: afterPos,
      });
    }
  }

  const hasChanges = dedupRemoved.length > 0 || reordered.length > 0;

  return {
    removed: dedupRemoved,
    reordered,
    hasChanges,
  };
}