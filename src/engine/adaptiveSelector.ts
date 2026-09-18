import { getDifficultyConfig } from '@/engine/difficulty';
import { generateQuestion } from '@/engine/questionGenerator';
import { clampLevel, SKILL_IDS } from '@/engine/skills';
import { getRecentSkillHealth } from '@/engine/progression';
import { getProblemWeakness } from '@/engine/statistics';
import {
  createQuestion,
} from '@/engine/questionGenerator';
import {
  Operation,
  ProblemStats,
  Question,
  SelectedSkill,
  SkillId,
  SkillProgress,
} from '@/types/game';

type SelectorInput = {
  selectedSkill: SelectedSkill;
  skillProgress: Record<SkillId, SkillProgress>;
  problemStats: Record<string, ProblemStats>;
  recentQuestionIds: string[];
};

type WeightedQuestion = {
  item: Question;
  weight: number;
};

function weightedPick<T>(items: { item: T; weight: number }[]): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from an empty candidate list');
  }

  const total = items.reduce((sum, entry) => sum + Math.max(0, entry.weight), 0);

  if (total <= 0) {
    return items[Math.floor(Math.random() * items.length)].item;
  }

  let threshold = Math.random() * total;

  for (const entry of items) {
    threshold -= Math.max(0, entry.weight);

    if (threshold <= 0) {
      return entry.item;
    }
  }

  return items[items.length - 1].item;
}

function selectSkill(input: SelectorInput): SkillId {
  if (input.selectedSkill !== 'all') {
    return input.selectedSkill;
  }

  return weightedPick(
    SKILL_IDS.map((skill) => {
      const progress = input.skillProgress[skill];
      const health = getRecentSkillHealth(progress);

      const lowLevelBias =
        Math.max(0, 1 - progress.level / 100) * 0.55;

      const weaknessBias =
        Math.max(0.2, 1.25 - health);

      return {
        item: skill,
        weight: 1 + lowLevelBias + weaknessBias,
      };
    }),
  );
}

function levelCandidates(progress: SkillProgress) {
  const health = getRecentSkillHealth(progress);

  const bias =
    health < 0.72
      ? -1
      : health > 0.93
        ? 1
        : 0;

  const base = progress.level + bias;

  return [
    {
      item: clampLevel(base - 2),
      weight: health < 0.72 ? 3.2 : 1.1,
    },
    {
      item: clampLevel(base - 1),
      weight: health < 0.72 ? 2.7 : 1.8,
    },
    {
      item: clampLevel(base),
      weight: 3.8,
    },
    {
      item: clampLevel(base + 1),
      weight: health < 0.72 ? 0.7 : 2.0,
    },
    {
      item: clampLevel(base + 2),
      weight: health > 0.88 ? 1.15 : 0.45,
    },
  ];
}

/**
 * Reconstruct a previously seen problem directly from its problem key.
 *
 * Keys are produced by getProblemKey():
 *   skill:num1:operation:num2
 *
 * Example:
 *   multiplication:7:multiply:8
 */
function questionFromProblemKey(
  key: string,
  level: number,
): Question | null {
  const parts = key.split(':');

  if (parts.length !== 4) {
    return null;
  }

  const [skill, num1String, operation, num2String] = parts;

  if (!SKILL_IDS.includes(skill as SkillId)) {
    return null;
  }

  const validOperations: Operation[] = [
    'add',
    'subtract',
    'multiply',
    'divide',
  ];

  if (!validOperations.includes(operation as Operation)) {
    return null;
  }

  const num1 = Number(num1String);
  const num2 = Number(num2String);

  if (!Number.isFinite(num1) || !Number.isFinite(num2)) {
    return null;
  }

  const safeSkill = skill as SkillId;
  const safeOperation = operation as Operation;
  const safeLevel = clampLevel(level);

  let answer: number;

  switch (safeOperation) {
    case 'add':
      answer = num1 + num2;
      break;

    case 'subtract':
      answer = num1 - num2;
      break;

    case 'multiply':
      answer = num1 * num2;
      break;

    case 'divide':
      answer = num2 === 0 ? 0 : num1 / num2;
      break;

    default:
      return null;
  }

  return {
    id: `${safeSkill}-${safeLevel}-${safeOperation}-${num1}-${num2}`,
    skill: safeSkill,
    level: safeLevel,
    num1,
    num2,
    operation: safeOperation,
    answer,
  };
}
function questionFromStats(
  stats: ProblemStats,
): Question {
  return createQuestion(
    stats.skill,
    stats.level,
    stats.operation,
    stats.num1,
    stats.num2,
  );
}
/**
 * Returns true when a problem has enough evidence to be considered mastered.
 *
 * Mastered problems should still occasionally appear for maintenance,
 * but they should not dominate the session.
 */
function isMastered(
  stats: ProblemStats,
  targetTimeMs: number,
): boolean {
  if (stats.attempts < 3) {
    return false;
  }

  const accuracy = stats.correct / stats.attempts;

  return (
    accuracy >= 0.9 &&
    stats.medianTimeMs <= targetTimeMs * 0.75
  );
}

/**
 * Calculate how strongly a known problem should be selected.
 *
 * Wrong answers and slow answers get a large boost.
 * Repeatedly correct + fast problems get heavily suppressed.
 */
function getKnownProblemWeight(
  stats: ProblemStats,
  targetTimeMs: number,
): number {
  if (isMastered(stats, targetTimeMs)) {
    return 0.08;
  }

  const weakness = getProblemWeakness(
    stats,
    targetTimeMs,
  );

  /*
   * The existing weakness function is intentionally kept as the
   * foundation, but amplified here so meaningful weaknesses actually
   * affect selection.
   */
  const weaknessWeight = 1 + weakness * 4;

  /*
   * Problems with very few attempts are useful for exploration/review,
   * but shouldn't overpower genuinely weak problems.
   */
  const uncertaintyBonus =
    stats.attempts < 3
      ? 1.25
      : stats.attempts < 6
        ? 1.1
        : 1;

  return Math.max(
    0.05,
    weaknessWeight * uncertaintyBonus,
  );
}

function applyRecentPenalty(
  question: Question,
  weight: number,
  recentQuestionIds: string[],
): number {
  if (recentQuestionIds.length === 0) {
    return weight;
  }

  /*
   * Never immediately repeat the same question.
   */
  if (recentQuestionIds[0] === question.id) {
    return 0;
  }

  /*
   * Still allow weak questions to return relatively soon.
   * We don't want the recent-question memory to hide weaknesses.
   */
  if (recentQuestionIds.includes(question.id)) {
    return weight * 0.35;
  }

  return weight;
}

/**
 * Get previously seen problems for the selected skill, ranked by
 * their weakness.
 */
function getWeakKnownProblems(
  skill: SkillId,
  progress: SkillProgress,
  problemStats: Record<string, ProblemStats>,
  recentQuestionIds: string[],
): WeightedQuestion[] {
  const candidates: WeightedQuestion[] = [];

  for (const [problemKey, stats] of Object.entries(problemStats)) {
    const question = questionFromProblemKey(
      problemKey,
      progress.level,
    );

    if (!question || question.skill !== skill) {
      continue;
    }

    const config = getDifficultyConfig(
      skill,
      question.level,
    );

    const baseWeight = getKnownProblemWeight(
      stats,
      config.targetTimeMs,
    );

    const weight = applyRecentPenalty(
      question,
      baseWeight,
      recentQuestionIds,
    );

    if (weight > 0) {
      candidates.push({
        item: question,
        weight,
      });
    }
  }

  /*
   * Keep only the strongest weaknesses.
   *
   * This prevents a user with thousands of historical questions
   * from creating an enormous candidate pool.
   */
  return candidates
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 12);
}

/**
 * Generate fresh questions around the user's current level.
 */
function generateFreshCandidates(
  skill: SkillId,
  progress: SkillProgress,
  recentQuestionIds: string[],
  count: number,
): WeightedQuestion[] {
  const candidates: WeightedQuestion[] = [];
  const candidateLevels = levelCandidates(progress);

  for (let index = 0; index < count; index += 1) {
    const level = weightedPick(candidateLevels);
    const question = generateQuestion(skill, level);

    const weight = applyRecentPenalty(
      question,
      1,
      recentQuestionIds,
    );

    if (weight > 0) {
      candidates.push({
        item: question,
        weight,
      });
    }
  }

  return candidates;
}

/**
 * Select the next question using an exploit/explore strategy:
 *
 *   ~65% known weak/review problems
 *   ~25% current-level fresh questions
 *   ~10% exploration
 *
 * Most importantly, weak known problems are injected directly into
 * the candidate pool instead of relying on random generation.
 */
export function selectNextQuestion(
  input: SelectorInput,
): Question {
  const skill = selectSkill(input);
  const progress = input.skillProgress[skill];

  const weakProblems = getWeakKnownProblems(
    skill,
    progress,
    input.problemStats,
    input.recentQuestionIds,
  );

  /*
   * If we have known problems, deliberately exploit them.
   */
  if (
    weakProblems.length > 0 &&
    Math.random() < 0.65
  ) {
    return weightedPick(weakProblems);
  }

  /*
   * Fresh current-level questions.
   */
  const freshCandidates = generateFreshCandidates(
    skill,
    progress,
    input.recentQuestionIds,
    12,
  );

  if (freshCandidates.length > 0) {
    return weightedPick(freshCandidates);
  }

  /*
   * Absolute fallback: generate one question.
   */
  return generateQuestion(
    skill,
    clampLevel(progress.level),
  );
}