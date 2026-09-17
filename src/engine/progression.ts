import { getDifficultyConfig } from '@/engine/difficulty';
import { clampLevel, MAX_LEVEL } from '@/engine/skills';
import { Attempt, ProgressionResult, SkillProgress } from '@/types/game';
import { median, percentile } from '@/utils/median';

export type ProgressionThresholds = {
  windowSize: number;
  minimumAttempts: number;
  targetAccuracy: number;
  consistencyMultiplier: number;
};

export const DEFAULT_PROGRESSION_THRESHOLDS: ProgressionThresholds = {
  windowSize: 10,
  minimumAttempts: 8,
  targetAccuracy: 0.85,
  consistencyMultiplier: 1.6,
};

export function evaluateLevelProgress(
  progress: SkillProgress,
  thresholds = DEFAULT_PROGRESSION_THRESHOLDS,
): ProgressionResult {
  const recent = progress.recentAttempts
    .filter((attempt) => attempt.level >= progress.level - 1)
    .slice(0, thresholds.windowSize);

  if (recent.length < thresholds.minimumAttempts) {
    return { nextLevel: progress.level, leveledUp: false, masteredLevel: null };
  }

  const correctCount = recent.filter((attempt) => attempt.correct).length;
  const accuracy = correctCount / recent.length;
  const durations = recent.map((attempt) => attempt.durationMs);
  const medianTime = median(durations);
  const consistencyTime = percentile(durations, 80);
  const targetTimeMs = getDifficultyConfig(recent[0].skill, progress.level).targetTimeMs;
  const isFastEnough = medianTime <= targetTimeMs;
  const isConsistent = consistencyTime <= targetTimeMs * thresholds.consistencyMultiplier;

  if (
    progress.level < MAX_LEVEL &&
    accuracy >= thresholds.targetAccuracy &&
    isFastEnough &&
    isConsistent
  ) {
    return {
      nextLevel: clampLevel(progress.level + 1),
      leveledUp: true,
      masteredLevel: progress.level,
    };
  }

  return { nextLevel: progress.level, leveledUp: false, masteredLevel: null };
}

export function updateSkillProgress(progress: SkillProgress, attempt: Attempt) {
  const recentAttempts = [attempt, ...progress.recentAttempts].slice(0, 80);
  const preliminary: SkillProgress = {
    ...progress,
    attempts: progress.attempts + 1,
    correct: progress.correct + (attempt.correct ? 1 : 0),
    recentAttempts,
  };
  const progression = evaluateLevelProgress(preliminary);

  return {
    progress: {
      ...preliminary,
      level: progression.nextLevel,
      masteredLevels:
        progression.masteredLevel && !preliminary.masteredLevels.includes(progression.masteredLevel)
          ? [...preliminary.masteredLevels, progression.masteredLevel].slice(-100)
          : preliminary.masteredLevels,
    },
    progression,
  };
}

export function getRecentSkillHealth(progress: SkillProgress) {
  const recent = progress.recentAttempts.slice(0, 8);
  if (recent.length < 4) return 1;

  const correct = recent.filter((attempt) => attempt.correct).length;
  const accuracy = correct / recent.length;
  const targetTimeMs = getDifficultyConfig(recent[0].skill, progress.level).targetTimeMs;
  const speed = median(recent.map((attempt) => attempt.durationMs)) <= targetTimeMs ? 1 : 0;

  return accuracy * 0.75 + speed * 0.25;
}
