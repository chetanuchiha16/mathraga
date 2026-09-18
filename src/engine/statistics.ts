import { median } from '@/utils/median';
import { Attempt, ProblemStats, Question } from '@/types/game';
export const MAX_RECENT_ATTEMPTS = 80;
export const MAX_RECENT_PROBLEM_TIMES = 12;

const DAY_MS = 1000 * 60 * 60 * 24;

export function getAccuracy(correct: number, attempts: number) {
  return attempts === 0 ? 0 : correct / attempts;
}

export function summarizeAttempts(attempts: Attempt[]) {
  const correct = attempts.filter((attempt) => attempt.correct).length;
  const durations = attempts.map((attempt) => attempt.durationMs);

  return {
    attempts: attempts.length,
    correct,
    accuracy: getAccuracy(correct, attempts.length),
    medianTimeMs: median(durations),
  };
}

export function updateProblemStats(
  existing: ProblemStats | undefined,
  question: Question,
  correct: boolean,
  durationMs: number,
) {
  const recentDurationsMs = [
    durationMs,
    ...(existing?.recentDurationsMs ?? []),
  ].slice(0, MAX_RECENT_PROBLEM_TIMES);

  return {
  attempts: (existing?.attempts ?? 0) + 1,
  correct: (existing?.correct ?? 0) + (correct ? 1 : 0),

  recentDurationsMs,
  medianTimeMs: median(recentDurationsMs),

  lastSeen: Date.now(),

  skill: question.skill,
  level: question.level,
  num1: question.num1,
  num2: question.num2,
  operation: question.operation,
};
}

/**
 * Measures how much a known problem needs practice.
 *
 * Higher = weaker = should be selected more often.
 *
 * Components:
 *
 * 1. Error pressure
 *    Wrong answers are the strongest signal.
 *
 * 2. Time pressure
 *    Slow answers are compared against the target time
 *    for the current difficulty level.
 *
 * 3. Review pressure
 *    A problem that hasn't been seen for a while gets a
 *    small boost so mastered material doesn't disappear forever.
 *
 * This function intentionally does NOT decide whether a problem
 * is mastered. The selector handles mastery suppression separately.
 */
export function getProblemWeakness(
  stats: ProblemStats | undefined,
  targetTimeMs: number,
) {
  if (!stats || stats.attempts === 0) {
    return 0;
  }

  const accuracy = getAccuracy(
    stats.correct,
    stats.attempts,
  );

  /*
   * -------------------------
   * 1. ERROR PRESSURE
   * -------------------------
   *
   * 0% accuracy  -> 2.0
   * 50% accuracy -> 1.0
   * 75% accuracy -> 0.5
   * 100% accuracy -> 0
   *
   * Wrong answers therefore have a substantial effect.
   */
  const errorPressure =
    Math.max(0, 1 - accuracy) * 2;

  /*
   * -------------------------
   * 2. TIME PRESSURE
   * -------------------------
   *
   * At target time:
   *   0
   *
   * At 2x target:
   *   1
   *
   * At 3x target:
   *   2
   *
   * Fast answers don't create negative weakness.
   */
  const timeRatio =
    targetTimeMs > 0
      ? stats.medianTimeMs / targetTimeMs
      : 1;

  const timePressure =
    Math.max(0, timeRatio - 1);

  /*
   * -------------------------
   * 3. REVIEW PRESSURE
   * -------------------------
   *
   * Give older problems a small review boost.
   *
   * Immediately after answering:
   *   ~0
   *
   * After 1 day:
   *   0.10
   *
   * After several days:
   *   approaches 0.20
   *
   * This is deliberately much weaker than an actual
   * wrong/slow signal.
   */
  const ageDays = Math.max(
    0,
    (Date.now() - stats.lastSeen) / DAY_MS,
  );

  const reviewPressure =
    Math.min(1, ageDays / 7) * 0.20;

  return (
    errorPressure +
    timePressure +
    reviewPressure
  );
}

/**
 * Returns a normalized mastery score between 0 and 1.
 *
 * 0 = little/no evidence of mastery
 * 1 = strong evidence of mastery
 *
 * This is useful for UI/statistics and for future selector logic.
 */
export function getProblemMastery(
  stats: ProblemStats | undefined,
  targetTimeMs: number,
) {
  if (!stats || stats.attempts === 0) {
    return 0;
  }

  const accuracy = getAccuracy(
    stats.correct,
    stats.attempts,
  );

  /*
   * Accuracy contributes 60%.
   */
  const accuracyScore = accuracy;

  /*
   * Speed contributes 40%.
   *
   * 1.0x target -> 1.0
   * 0.75x target -> 1.0
   * 1.5x target -> 0.67
   * 2.0x target -> 0.50
   */
  const speedScore =
    targetTimeMs > 0
      ? Math.min(
          1,
          targetTimeMs / Math.max(
            targetTimeMs * 0.75,
            stats.medianTimeMs,
          ),
        )
      : 0;

  /*
   * A single lucky fast answer shouldn't immediately
   * classify a problem as mastered.
   *
   * Confidence ramps up over the first 5 attempts.
   */
  const confidence =
    Math.min(1, stats.attempts / 5);

  return (
    (accuracyScore * 0.6 +
      speedScore * 0.4) *
    confidence
  );
}

/**
 * A problem is considered mastered only when there is
 * enough evidence that the user knows it.
 */
export function isProblemMastered(
  stats: ProblemStats | undefined,
  targetTimeMs: number,
) {
  if (!stats || stats.attempts < 3) {
    return false;
  }

  const accuracy = getAccuracy(
    stats.correct,
    stats.attempts,
  );

  return (
    accuracy >= 0.9 &&
    stats.medianTimeMs <= targetTimeMs * 0.75
  );
}