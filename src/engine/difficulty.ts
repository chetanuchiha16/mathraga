import { DifficultyConfig, SkillId } from '@/types/game';

type DifficultyAnchor = DifficultyConfig & {
  level: number;
};

const anchors: Record<SkillId, DifficultyAnchor[]> = {
  addition: [
    { level: 1, minOperand: 2, maxOperand: 9, digitComplexity: 1, carryProbability: 0.05, borrowProbability: 0, multiplicationComplexity: 0, targetTimeMs: 2200 },
    { level: 20, minOperand: 8, maxOperand: 38, digitComplexity: 2, carryProbability: 0.25, borrowProbability: 0, multiplicationComplexity: 0, targetTimeMs: 2600 },
    { level: 45, minOperand: 20, maxOperand: 98, digitComplexity: 2, carryProbability: 0.58, borrowProbability: 0, multiplicationComplexity: 0, targetTimeMs: 3300 },
    { level: 70, minOperand: 110, maxOperand: 520, digitComplexity: 3, carryProbability: 0.74, borrowProbability: 0, multiplicationComplexity: 0, targetTimeMs: 4500 },
    { level: 100, minOperand: 300, maxOperand: 999, digitComplexity: 3, carryProbability: 0.86, borrowProbability: 0, multiplicationComplexity: 0, targetTimeMs: 6000 },
  ],
  subtraction: [
    { level: 1, minOperand: 2, maxOperand: 12, digitComplexity: 1, carryProbability: 0, borrowProbability: 0.05, multiplicationComplexity: 0, targetTimeMs: 2400 },
    { level: 20, minOperand: 12, maxOperand: 48, digitComplexity: 2, carryProbability: 0, borrowProbability: 0.28, multiplicationComplexity: 0, targetTimeMs: 3000 },
    { level: 45, minOperand: 35, maxOperand: 120, digitComplexity: 2, carryProbability: 0, borrowProbability: 0.62, multiplicationComplexity: 0, targetTimeMs: 3800 },
    { level: 70, minOperand: 140, maxOperand: 620, digitComplexity: 3, carryProbability: 0, borrowProbability: 0.76, multiplicationComplexity: 0, targetTimeMs: 5000 },
    { level: 100, minOperand: 360, maxOperand: 999, digitComplexity: 3, carryProbability: 0, borrowProbability: 0.9, multiplicationComplexity: 0, targetTimeMs: 6600 },
  ],
  multiplication: [
    { level: 1, minOperand: 2, maxOperand: 5, digitComplexity: 1, carryProbability: 0, borrowProbability: 0, multiplicationComplexity: 0.1, targetTimeMs: 2400 },
    { level: 18, minOperand: 2, maxOperand: 12, digitComplexity: 1, carryProbability: 0, borrowProbability: 0, multiplicationComplexity: 0.35, targetTimeMs: 2800 },
    { level: 45, minOperand: 7, maxOperand: 22, digitComplexity: 2, carryProbability: 0, borrowProbability: 0, multiplicationComplexity: 0.58, targetTimeMs: 4200 },
    { level: 72, minOperand: 12, maxOperand: 48, digitComplexity: 2, carryProbability: 0, borrowProbability: 0, multiplicationComplexity: 0.75, targetTimeMs: 6200 },
    { level: 100, minOperand: 24, maxOperand: 99, digitComplexity: 2, carryProbability: 0, borrowProbability: 0, multiplicationComplexity: 0.94, targetTimeMs: 8500 },
  ],
  division: [
    { level: 1, minOperand: 2, maxOperand: 6, digitComplexity: 1, carryProbability: 0, borrowProbability: 0, multiplicationComplexity: 0.1, targetTimeMs: 2600 },
    { level: 20, minOperand: 2, maxOperand: 12, digitComplexity: 1, carryProbability: 0, borrowProbability: 0, multiplicationComplexity: 0.32, targetTimeMs: 3400 },
    { level: 45, minOperand: 4, maxOperand: 24, digitComplexity: 2, carryProbability: 0, borrowProbability: 0, multiplicationComplexity: 0.55, targetTimeMs: 4800 },
    { level: 72, minOperand: 8, maxOperand: 48, digitComplexity: 3, carryProbability: 0, borrowProbability: 0, multiplicationComplexity: 0.72, targetTimeMs: 7000 },
    { level: 100, minOperand: 12, maxOperand: 96, digitComplexity: 3, carryProbability: 0, borrowProbability: 0, multiplicationComplexity: 0.9, targetTimeMs: 9500 },
  ],
};

function interpolate(left: number, right: number, progress: number) {
  return left + (right - left) * progress;
}

export function getDifficultyConfig(skill: SkillId, level: number): DifficultyConfig {
  const skillAnchors = anchors[skill];
  const upperIndex = skillAnchors.findIndex((anchor) => anchor.level >= level);

  if (upperIndex <= 0) {
    const first = skillAnchors[0];
    return { ...first };
  }

  const upper = skillAnchors[upperIndex];
  const lower = skillAnchors[upperIndex - 1];
  const progress = (level - lower.level) / (upper.level - lower.level);

  return {
    minOperand: Math.round(interpolate(lower.minOperand, upper.minOperand, progress)),
    maxOperand: Math.round(interpolate(lower.maxOperand, upper.maxOperand, progress)),
    digitComplexity: Math.round(interpolate(lower.digitComplexity, upper.digitComplexity, progress)),
    carryProbability: interpolate(lower.carryProbability, upper.carryProbability, progress),
    borrowProbability: interpolate(lower.borrowProbability, upper.borrowProbability, progress),
    multiplicationComplexity: interpolate(
      lower.multiplicationComplexity,
      upper.multiplicationComplexity,
      progress,
    ),
    targetTimeMs: Math.round(interpolate(lower.targetTimeMs, upper.targetTimeMs, progress)),
  };
}
