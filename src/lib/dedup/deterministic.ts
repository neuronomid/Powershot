function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

/**
 * Find the longest prefix of `chunkB` (in normalized space) that is also a
 * suffix of `chunkA` (in normalized space).
 *
 * We iterate every possible prefix length of the original `chunkB` and compare
 * normalized versions. This is O(n·m) where n = len(chunkB) and m is the cost
 * of normalizing a prefix, but for typical Markdown chunks (a few KB) this is
 * negligible and guarantees an exact mapping back to original character indices.
 */
function longestMatchingPrefixLength(chunkA: string, chunkB: string): number {
  const normA = normalize(chunkA);
  let bestLen = 0;

  for (let len = 1; len <= chunkB.length; len++) {
    const prefixB = chunkB.slice(0, len);
    const normPrefixB = normalize(prefixB);
    if (normPrefixB.length > normA.length) break;
    if (normA.endsWith(normPrefixB)) {
      bestLen = len;
    }
  }

  return bestLen;
}

/**
 * Deterministic seam dedup for two adjacent Markdown chunks.
 *
 * Computes the longest common suffix/prefix overlap using normalized text
 * (whitespace-collapsed, lowercased). If the overlap meets the threshold
 * (>= 60 normalized characters or >= 2 full lines in the original text),
 * the overlapping prefix is removed from the later chunk (chunkB).
 *
 * @returns The cleaned pair. cleanedA is always unchanged; cleanedB may be trimmed.
 */
export function dedupAdjacentChunks(
  chunkA: string,
  chunkB: string,
): { cleanedA: string; cleanedB: string } {
  const bestLen = longestMatchingPrefixLength(chunkA, chunkB);
  if (bestLen === 0) {
    return { cleanedA: chunkA, cleanedB: chunkB };
  }

  const overlapOriginal = chunkB.slice(0, bestLen);
  const overlapNorm = normalize(overlapOriginal);

  // Threshold: >= 60 normalized characters OR >= 2 full lines in original.
  const charCount = overlapNorm.length;
  const lineCount = overlapOriginal
    .split("\n")
    .filter((l) => l.trim()).length;

  if (charCount < 60 && lineCount < 2) {
    return { cleanedA: chunkA, cleanedB: chunkB };
  }

  return { cleanedA: chunkA, cleanedB: chunkB.slice(bestLen) };
}

/**
 * Run deterministic dedup over an ordered array of chunks.
 * Processes left-to-right so each cleaned chunk becomes the left side
 * for the next pair.
 */
export function dedupChunkList(chunks: string[]): string[] {
  if (chunks.length === 0) return [];
  const result: string[] = [chunks[0]!];
  for (let i = 1; i < chunks.length; i++) {
    const prev = result[result.length - 1]!;
    const next = chunks[i]!;
    const { cleanedB } = dedupAdjacentChunks(prev, next);
    result.push(cleanedB);
  }
  return result;
}
