import { describe, it, expect } from "vitest";

import { applyReview, isDue } from "./sm2";
import { initialSM2State } from "./types";

const NOW = 1_700_000_000_000;
const MS_PER_DAY = 86_400_000;

describe("SM-2-lite", () => {
  it("again resets interval to 10-minute relearn and bumps lapses", () => {
    const s = initialSM2State(NOW);
    const next = applyReview(
      { ...s, repetitions: 4, intervalDays: 15, ease: 2.5 },
      "again",
      NOW,
    );
    expect(next.intervalDays).toBe(0);
    expect(next.repetitions).toBe(0);
    expect(next.lapses).toBe(1);
    expect(next.ease).toBe(2.3);
    expect(next.dueAt).toBe(NOW + 10 * 60 * 1000);
  });

  it("ease is clamped to 1.3 floor on repeated again", () => {
    let state = { ...initialSM2State(NOW), ease: 1.4 };
    state = applyReview(state, "again", NOW);
    expect(state.ease).toBe(1.3);
    state = applyReview(state, "again", NOW);
    expect(state.ease).toBe(1.3);
  });

  it("good graduates first review to 1 day, second to 3, then interval*ease", () => {
    let state = initialSM2State(NOW);

    state = applyReview(state, "good", NOW);
    expect(state.repetitions).toBe(1);
    expect(state.intervalDays).toBe(1);
    expect(state.ease).toBe(2.5);
    expect(state.dueAt).toBe(NOW + 1 * MS_PER_DAY);

    state = applyReview(state, "good", NOW);
    expect(state.repetitions).toBe(2);
    expect(state.intervalDays).toBe(3);

    state = applyReview(state, "good", NOW);
    // third good: 3 * 2.5 = 7.5
    expect(state.intervalDays).toBeCloseTo(7.5, 5);
  });

  it("easy bumps ease and gives larger interval", () => {
    let state = initialSM2State(NOW);
    state = applyReview(state, "easy", NOW);
    expect(state.ease).toBe(2.65);
    expect(state.intervalDays).toBe(4);

    state = applyReview(state, "easy", NOW);
    // interval*ease*1.3 = 4 * 2.65 * 1.3 = 13.78 → rounded to 13.8
    expect(state.intervalDays).toBeCloseTo(13.8, 1);
    expect(state.ease).toBe(2.8);
  });

  it("hard drops ease and grows interval slowly", () => {
    let state = initialSM2State(NOW);
    state = applyReview(state, "good", NOW); // interval=1
    state = applyReview(state, "hard", NOW);
    // 1 * 1.2 = 1.2
    expect(state.intervalDays).toBeCloseTo(1.2, 5);
    expect(state.ease).toBeLessThan(2.5);
  });

  it("isDue compares dueAt against now", () => {
    const s = { ...initialSM2State(NOW), dueAt: NOW - 1 };
    expect(isDue(s, NOW)).toBe(true);
    expect(isDue({ ...s, dueAt: NOW + 1 }, NOW)).toBe(false);
  });
});
