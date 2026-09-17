import { SkillId } from '@/types/game';

export const SKILL_IDS: SkillId[] = ['addition', 'subtraction', 'multiplication', 'division'];

export const SKILL_NAMES: Record<SkillId, string> = {
  addition: 'Addition',
  subtraction: 'Subtraction',
  multiplication: 'Multiplication',
  division: 'Division',
};

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 100;

export function clampLevel(level: number) {
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));
}
