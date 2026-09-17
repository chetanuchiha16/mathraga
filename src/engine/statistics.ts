import { Attempt, ProblemStats } from '@/types/game';
import { median } from '@/utils/median';

export const MAX_RECENT_ATTEMPTS = 80;
export const MAX_RECENT_PROBLEM_TIMES = 12;

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

export function updateProblemStats(existing: ProblemStats | undefined, correct: boolean, durationMs: number) {
  const recentDurationsMs = [durationMs, ...(existing?.recentDurationsMs ?? [])].slice(
    0,
    MAX_RECENT_PROBLEM_TIMES,
  );

  return {
    attempts: (existing?.attempts ?? 0) + 1,
    correct: (existing?.correct ?? 0) + (correct ? 1 : 0),
    recentDurationsMs,
    medianTimeMs: median(recentDurationsMs),
    lastSeen: Date.now(),
  };
}

export function getProblemWeakness(stats: ProblemStats | undefined, targetTimeMs: number) {
  if (!stats || stats.attempts === 0) return 0;

  const accuracy = getAccuracy(stats.correct, stats.attempts);
  const timePressure = Math.max(0, stats.medianTimeMs / targetTimeMs - 1);
  const errorPressure = Math.max(0, 1 - accuracy);
  const recencyRelief = Math.min(1, (Date.now() - stats.lastSeen) / (1000 * 60 * 60 * 24));

  return errorPressure * 2 + timePressure + recencyRelief * 0.25;
}
