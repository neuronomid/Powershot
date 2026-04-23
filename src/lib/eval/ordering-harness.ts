/**
 * Ordering accuracy benchmark harness.
 *
 * This is an **offline** evaluation tool (not live telemetry).
 * It scores how well the order-inference cascade reproduces a known
 * correct sequence of screenshots.
 *
 * Usage: import and call `runOrderingHarness(fixtures)` in a test file
 * or Node script. The fixture set is assembled manually from real
 * screenshot batches with verified chronological order.
 */

import { detectAndOrder } from "@/lib/upload/order-inference";
import type { StagedImage } from "@/lib/upload/types";

export type OrderingFixture = {
  id: string;
  name: string;
  images: StagedImage[];
  expectedOrderIds: string[];
};

export type OrderingResult = {
  fixtureId: string;
  correct: number;
  total: number;
  accuracy: number;
  inversionCount: number;
  kendallTau: number;
};

function countInversions(actual: string[], expected: string[]): number {
  const indexMap = new Map<string, number>();
  expected.forEach((id, idx) => indexMap.set(id, idx));

  const positions = actual
    .map((id) => indexMap.get(id))
    .filter((v): v is number => v !== undefined);

  let inversions = 0;
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      if (positions[i]! > positions[j]!) inversions++;
    }
  }
  return inversions;
}

function kendallTau(actual: string[], expected: string[]): number {
  const n = expected.length;
  if (n <= 1) return 1;
  const maxInversions = (n * (n - 1)) / 2;
  const inversions = countInversions(actual, expected);
  return maxInversions === 0 ? 1 : 1 - inversions / maxInversions;
}

export async function runOrderingHarness(
  fixtures: OrderingFixture[],
): Promise<{
  results: OrderingResult[];
  averageAccuracy: number;
  averageKendallTau: number;
}> {
  const results: OrderingResult[] = [];

  for (const fixture of fixtures) {
    const { ordered } = await detectAndOrder(fixture.images);
    const actualIds = ordered.map((i) => i.id);

    let correct = 0;
    for (let i = 0; i < fixture.expectedOrderIds.length; i++) {
      if (actualIds[i] === fixture.expectedOrderIds[i]) correct++;
    }

    const inversions = countInversions(actualIds, fixture.expectedOrderIds);
    const kt = kendallTau(actualIds, fixture.expectedOrderIds);

    results.push({
      fixtureId: fixture.id,
      correct,
      total: fixture.expectedOrderIds.length,
      accuracy: correct / (fixture.expectedOrderIds.length || 1),
      inversionCount: inversions,
      kendallTau: kt,
    });
  }

  const averageAccuracy =
    results.reduce((s, r) => s + r.accuracy, 0) / (results.length || 1);
  const averageKendallTau =
    results.reduce((s, r) => s + r.kendallTau, 0) / (results.length || 1);

  return { results, averageAccuracy, averageKendallTau };
}
