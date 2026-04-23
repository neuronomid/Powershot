/**
 * Extraction fidelity benchmark harness.
 *
 * This is an **offline** evaluation tool (not live telemetry).
 * It compares model-extracted Markdown against a known-good reference
 * using a simple token-based overlap metric.
 *
 * Usage: import and call `runFidelityHarness(fixtures)` in a test file
 * or Node script. The fixture set is assembled manually from real
 * screenshots with verified ground-truth transcripts.
 */

export type FidelityFixture = {
  id: string;
  name: string;
  referenceMarkdown: string;
  extractedMarkdown: string;
};

export type FidelityResult = {
  fixtureId: string;
  precision: number;
  recall: number;
  f1: number;
  tokenOverlap: number;
  tokenTotal: number;
};

function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

export function scoreFidelity(
  reference: string,
  extracted: string,
): {
  precision: number;
  recall: number;
  f1: number;
  overlap: number;
  total: number;
} {
  const refTokens = new Set(normalizeTokens(reference));
  const extTokens = new Set(normalizeTokens(extracted));

  if (refTokens.size === 0 && extTokens.size === 0) {
    return { precision: 1, recall: 1, f1: 1, overlap: 0, total: 0 };
  }
  if (refTokens.size === 0) {
    return { precision: 0, recall: 1, f1: 0, overlap: 0, total: 0 };
  }
  if (extTokens.size === 0) {
    return { precision: 1, recall: 0, f1: 0, overlap: 0, total: 0 };
  }

  let overlap = 0;
  for (const token of extTokens) {
    if (refTokens.has(token)) overlap++;
  }

  const precision = overlap / extTokens.size;
  const recall = overlap / refTokens.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return { precision, recall, f1, overlap, total: refTokens.size };
}

export function runFidelityHarness(fixtures: FidelityFixture[]): {
  results: FidelityResult[];
  averagePrecision: number;
  averageRecall: number;
  averageF1: number;
} {
  const results: FidelityResult[] = fixtures.map((f) => {
    const scores = scoreFidelity(f.referenceMarkdown, f.extractedMarkdown);
    return {
      fixtureId: f.id,
      precision: scores.precision,
      recall: scores.recall,
      f1: scores.f1,
      tokenOverlap: scores.overlap,
      tokenTotal: scores.total,
    };
  });

  const averagePrecision =
    results.reduce((s, r) => s + r.precision, 0) / (results.length || 1);
  const averageRecall =
    results.reduce((s, r) => s + r.recall, 0) / (results.length || 1);
  const averageF1 =
    results.reduce((s, r) => s + r.f1, 0) / (results.length || 1);

  return { results, averagePrecision, averageRecall, averageF1 };
}
