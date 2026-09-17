import { Question } from '@/types/game';

function splitPlaceValue(value: number) {
  if (value < 10) return `${value}`;

  const hundreds = Math.floor(value / 100) * 100;
  const tens = Math.floor((value % 100) / 10) * 10;
  const ones = value % 10;
  return [hundreds, tens, ones].filter(Boolean).join(' + ');
}

export function getMentalMathHints(question: Question) {
  const { num1, num2, operation, answer } = question;

  if (operation === 'add') {
    const nearTen = num2 <= 20 && num2 % 10 >= 7;
    if (nearTen) {
      const bump = 10 - (num2 % 10);
      return [
        `Compensation: add ${num2 + bump}, then subtract ${bump}.`,
        `${num1} + ${num2 + bump} = ${num1 + num2 + bump}`,
        `${num1 + num2 + bump} - ${bump} = ${answer}.`,
      ];
    }

    return [
      `Partition: ${num1} is ${splitPlaceValue(num1)}.`,
      `${num2} is ${splitPlaceValue(num2)}.`,
      'Add the larger place values first, then the leftovers.',
    ];
  }

  if (operation === 'subtract') {
    return [
      `Count up from ${num2} to ${num1}.`,
      `Or partition: ${num1} - ${splitPlaceValue(num2)}.`,
      `The difference is ${answer}.`,
    ];
  }

  if (operation === 'multiply') {
    if (num1 === num2) {
      return [`Square: ${num1} x ${num1}.`, `Think ${num1} groups of ${num1}.`, `Result: ${answer}.`];
    }

    const easier = Math.min(num1, num2);
    const harder = Math.max(num1, num2);
    return [
      `Break apart ${harder}: ${harder - 1} + 1.`,
      `${easier} x ${harder - 1} = ${easier * (harder - 1)}`,
      `Add one more ${easier}: ${easier * (harder - 1)} + ${easier} = ${answer}.`,
    ];
  }

  return [
    `Reverse it: ${num1} / ${num2} asks what times ${num2} makes ${num1}.`,
    `${num2} x ${answer} = ${num1}.`,
    `So the answer is ${answer}.`,
  ];
}
