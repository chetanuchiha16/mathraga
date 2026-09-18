import { getDifficultyConfig } from '@/engine/difficulty';
import { clampLevel } from '@/engine/skills';
import { DifficultyConfig, Operation, Question, SkillId } from '@/types/game';

type RandomSource = () => number;

function randomInt(min: number, max: number, random: RandomSource) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function hasCarry(left: number, right: number) {
  let a = left;
  let b = right;

  while (a > 0 || b > 0) {
    if ((a % 10) + (b % 10) >= 10) return true;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }

  return false;
}

function hasBorrow(left: number, right: number) {
  let a = left;
  let b = right;

  while (a > 0 || b > 0) {
    if (a % 10 < b % 10) return true;
    a = Math.floor(a / 10);
    b = Math.floor(b / 10);
  }

  return false;
}

function pickOperand(config: DifficultyConfig, random: RandomSource) {
  return randomInt(config.minOperand, config.maxOperand, random);
}

function makeQuestionId(skill: SkillId, level: number, operation: Operation, num1: number, num2: number) {
  return `${skill}-${level}-${operation}-${num1}-${num2}`;
}

function generateAddition(level: number, random: RandomSource): Question {
  const config = getDifficultyConfig('addition', level);
  let num1 = pickOperand(config, random);
  let num2 = pickOperand(config, random);
  const wantsCarry = random() < config.carryProbability;

  for (let attempt = 0; attempt < 12 && hasCarry(num1, num2) !== wantsCarry; attempt += 1) {
    num1 = pickOperand(config, random);
    num2 = pickOperand(config, random);
  }

  return {
    id: makeQuestionId('addition', level, 'add', num1, num2),
    skill: 'addition',
    level,
    num1,
    num2,
    operation: 'add',
    answer: num1 + num2,
  };
}

function generateSubtraction(level: number, random: RandomSource): Question {
  const config = getDifficultyConfig('subtraction', level);
  let num1 = pickOperand(config, random);
  let num2 = pickOperand(config, random);
  const wantsBorrow = random() < config.borrowProbability;

  if (num2 > num1) {
    [num1, num2] = [num2, num1];
  }

  for (let attempt = 0; attempt < 12 && hasBorrow(num1, num2) !== wantsBorrow; attempt += 1) {
    num1 = pickOperand(config, random);
    num2 = pickOperand(config, random);
    if (num2 > num1) {
      [num1, num2] = [num2, num1];
    }
  }

  return {
    id: makeQuestionId('subtraction', level, 'subtract', num1, num2),
    skill: 'subtraction',
    level,
    num1,
    num2,
    operation: 'subtract',
    answer: num1 - num2,
  };
}

function generateMultiplication(level: number, random: RandomSource): Question {
  const config = getDifficultyConfig('multiplication', level);
  const complexityBias = 1 + config.multiplicationComplexity;
  const low = Math.max(2, Math.round(config.minOperand / complexityBias));
  const high = Math.max(low + 1, config.maxOperand);
  const num1 = randomInt(low, high, random);
  const num2 = randomInt(config.minOperand, config.maxOperand, random);

  return {
    id: makeQuestionId('multiplication', level, 'multiply', num1, num2),
    skill: 'multiplication',
    level,
    num1,
    num2,
    operation: 'multiply',
    answer: num1 * num2,
  };
}

function generateDivision(level: number, random: RandomSource): Question {
  const config = getDifficultyConfig('division', level);
  const divisor = randomInt(Math.max(2, config.minOperand), Math.max(3, config.maxOperand), random);
  const quotientMax = Math.max(3, Math.round(config.maxOperand * (1 + config.multiplicationComplexity)));
  const quotient = randomInt(Math.max(2, Math.round(config.minOperand / 2)), quotientMax, random);
  const num1 = divisor * quotient;
  const num2 = divisor;

  return {
    id: makeQuestionId('division', level, 'divide', num1, num2),
    skill: 'division',
    level,
    num1,
    num2,
    operation: 'divide',
    answer: quotient,
  };
}

export function generateQuestion(skill: SkillId, level: number, random: RandomSource = Math.random): Question {
  const safeLevel = clampLevel(level);

  if (skill === 'addition') return generateAddition(safeLevel, random);
  if (skill === 'subtraction') return generateSubtraction(safeLevel, random);
  if (skill === 'multiplication') return generateMultiplication(safeLevel, random);
  return generateDivision(safeLevel, random);
}
export function createQuestion(
  skill: SkillId,
  level: number,
  operation: Operation,
  num1: number,
  num2: number,
): Question {
  const safeLevel = clampLevel(level);

  let answer: number;

  switch (operation) {
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
      throw new Error(`Unsupported operation: ${operation}`);
  }

  return {
    id: makeQuestionId(
      skill,
      safeLevel,
      operation,
      num1,
      num2,
    ),
    skill,
    level: safeLevel,
    num1,
    num2,
    operation,
    answer,
  };
}
export function getQuestionPrompt(question: Question) {
  const symbol: Record<Operation, string> = {
    add: '+',
    subtract: '−',
    multiply: '×',
    divide: '÷',
  };

  return `${question.num1} ${symbol[question.operation]} ${question.num2}`;
}

export function getProblemKey(question: Question) {
  return `${question.skill}:${question.num1}:${question.operation}:${question.num2}`;
}
