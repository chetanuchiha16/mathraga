import { getDifficultyConfig } from '@/engine/difficulty';
import { generateQuestion, getProblemKey } from '@/engine/questionGenerator';
import { clampLevel, SKILL_IDS } from '@/engine/skills';
import { getRecentSkillHealth } from '@/engine/progression';
import { getProblemWeakness } from '@/engine/statistics';
import { ProblemStats, Question, SelectedSkill, SkillId, SkillProgress } from '@/types/game';

type SelectorInput = {
  selectedSkill: SelectedSkill;
  skillProgress: Record<SkillId, SkillProgress>;
  problemStats: Record<string, ProblemStats>;
  recentQuestionIds: string[];
};

function weightedPick<T>(items: { item: T; weight: number }[]) {
  const total = items.reduce((sum, entry) => sum + entry.weight, 0);
  let threshold = Math.random() * total;

  for (const entry of items) {
    threshold -= entry.weight;
    if (threshold <= 0) return entry.item;
  }

  return items[items.length - 1].item;
}

function selectSkill(input: SelectorInput): SkillId {
  if (input.selectedSkill !== 'all') return input.selectedSkill;

  return weightedPick(
    SKILL_IDS.map((skill) => {
      const progress = input.skillProgress[skill];
      const health = getRecentSkillHealth(progress);
      const lowLevelBias = Math.max(0, 1 - progress.level / 100) * 0.55;
      const weaknessBias = Math.max(0.2, 1.25 - health);

      return {
        item: skill,
        weight: 1 + lowLevelBias + weaknessBias,
      };
    }),
  );
}

function levelCandidates(progress: SkillProgress) {
  const health = getRecentSkillHealth(progress);
  const bias = health < 0.72 ? -1 : health > 0.93 ? 1 : 0;
  const base = progress.level + bias;

  return [
    { item: clampLevel(base - 2), weight: health < 0.72 ? 3.2 : 1.1 },
    { item: clampLevel(base - 1), weight: health < 0.72 ? 2.7 : 1.8 },
    { item: clampLevel(base), weight: 3.8 },
    { item: clampLevel(base + 1), weight: health < 0.72 ? 0.7 : 2.0 },
    { item: clampLevel(base + 2), weight: health > 0.88 ? 1.15 : 0.45 },
  ];
}

function scoreQuestion(question: Question, problemStats: Record<string, ProblemStats>, recentQuestionIds: string[]) {
  const config = getDifficultyConfig(question.skill, question.level);
  const stats = problemStats[getProblemKey(question)];
  const weakness = getProblemWeakness(stats, config.targetTimeMs);
  const duplicatePenalty = recentQuestionIds[0] === question.id ? 0 : 1;
  const shortWindowPenalty = recentQuestionIds.includes(question.id) ? 0.35 : 1;

  return Math.max(0.05, (1 + weakness) * duplicatePenalty * shortWindowPenalty);
}

export function selectNextQuestion(input: SelectorInput) {
  const skill = selectSkill(input);
  const progress = input.skillProgress[skill];
  const candidateLevels = levelCandidates(progress);
  const candidates: { item: Question; weight: number }[] = [];

  for (let index = 0; index < 18; index += 1) {
    const level = weightedPick(candidateLevels);
    const question = generateQuestion(skill, level);
    const weight = scoreQuestion(question, input.problemStats, input.recentQuestionIds);
    candidates.push({ item: question, weight });
  }

  const nonImmediateCandidates = candidates.filter((candidate) => candidate.weight > 0);
  return weightedPick(nonImmediateCandidates.length > 0 ? nonImmediateCandidates : candidates);
}
