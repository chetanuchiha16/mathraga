import { Question } from '@/types/game';

const operationWeight = {
  add: 1,
  subtract: 1.15,
  multiply: 1.55,
  divide: 1.75,
};

function digitCount(value: number) {
  return Math.max(1, Math.abs(value).toString().length);
}

export function calculateMentalLoad(question: Question, correct: boolean, durationMs: number) {
  const digitLoad = digitCount(question.num1) + digitCount(question.num2);
  const levelLoad = question.level / 8;
  const speedPressure = Math.min(8, durationMs / 1500);
  const correctionLoad = correct ? 0 : 6;

  return Math.max(
    1,
    Math.round((digitLoad + levelLoad + speedPressure + correctionLoad) * operationWeight[question.operation]),
  );
}
