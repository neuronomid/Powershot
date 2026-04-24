import type { SM2State } from "./types";

export type ReviewGrade = "again" | "hard" | "good" | "easy";

const MS_PER_DAY = 86_400_000;
const MIN_EASE = 1.3;
const RELEARN_INTERVAL_MINUTES = 10;

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clampEase(ease: number): number {
  return Math.max(MIN_EASE, Math.round(ease * 100) / 100);
}

/**
 * Apply an SM-2-lite transition. `now` is milliseconds since epoch.
 *
 * Transitions (Anki-style):
 *  - Again:  ease −0.2, reset to 10-minute relearn, lapses +1.
 *  - Hard:   ease −0.15, interval × 1.2 (min 1 day after first review).
 *  - Good:   ease unchanged. First-review graduates to 1 day; second to 3 days;
 *            thereafter interval × ease.
 *  - Easy:   ease +0.15. First-review graduates to 4 days; otherwise
 *            interval × ease × 1.3.
 *
 * Ease is clamped to a floor of 1.3. There is no cap.
 */
export function applyReview(state: SM2State, grade: ReviewGrade, now: number): SM2State {
  const reps = state.repetitions;

  if (grade === "again") {
    return {
      ease: clampEase(state.ease - 0.2),
      intervalDays: 0,
      repetitions: 0,
      lapses: state.lapses + 1,
      dueAt: now + RELEARN_INTERVAL_MINUTES * 60 * 1000,
      lastReviewedAt: now,
    };
  }

  if (grade === "hard") {
    const ease = clampEase(state.ease - 0.15);
    const baseInterval = reps === 0 ? 1 : Math.max(1, state.intervalDays);
    const next = round1(baseInterval * 1.2);
    return {
      ease,
      intervalDays: Math.max(1, next),
      repetitions: reps + 1,
      lapses: state.lapses,
      dueAt: now + Math.max(1, next) * MS_PER_DAY,
      lastReviewedAt: now,
    };
  }

  if (grade === "good") {
    let next: number;
    if (reps === 0) next = 1;
    else if (reps === 1) next = 3;
    else next = Math.max(1, round1(state.intervalDays * state.ease));
    return {
      ease: state.ease,
      intervalDays: next,
      repetitions: reps + 1,
      lapses: state.lapses,
      dueAt: now + next * MS_PER_DAY,
      lastReviewedAt: now,
    };
  }

  // grade === "easy"
  const ease = clampEase(state.ease + 0.15);
  let next: number;
  if (reps === 0) next = 4;
  else next = Math.max(1, round1(state.intervalDays * state.ease * 1.3));
  return {
    ease,
    intervalDays: next,
    repetitions: reps + 1,
    lapses: state.lapses,
    dueAt: now + next * MS_PER_DAY,
    lastReviewedAt: now,
  };
}

export function isDue(state: SM2State, now: number): boolean {
  return state.dueAt <= now;
}
