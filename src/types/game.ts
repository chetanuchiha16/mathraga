export type SkillId = 'addition' | 'subtraction' | 'multiplication' | 'division';

export type SelectedSkill = 'all' | SkillId;

export type Operation = 'add' | 'subtract' | 'multiply' | 'divide';

export type Skill = {
  id: SkillId;
  name: string;
  level: number;
};

export type DifficultyConfig = {
  minOperand: number;
  maxOperand: number;
  digitComplexity: number;
  carryProbability: number;
  borrowProbability: number;
  multiplicationComplexity: number;
  targetTimeMs: number;
};

export type Question = {
  id: string;
  skill: SkillId;
  level: number;
  num1: number;
  num2: number;
  operation: Operation;
  answer: number;
};

export type Attempt = {
  questionId: string;
  skill: SkillId;
  level: number;
  correct: boolean;
  durationMs: number;
  timestamp: number;
};

export type AnswerRecord = Attempt & {
  prompt: string;
  userAnswer: number;
  answer: number;
};

export type ProblemStats = {
  attempts: number;
  correct: number;
  recentDurationsMs: number[];
  medianTimeMs: number;
  lastSeen: number;
};

export type SkillProgress = {
  level: number;
  attempts: number;
  correct: number;
  recentAttempts: Attempt[];
  masteredLevels: number[];
};

export type AggregateStats = {
  totalAnswered: number;
  totalCorrect: number;
  recentAttempts: Attempt[];
};

export type StreakState = {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null;
  dailyQuestionsAnswered: number;
  dailyGoal: number;
};

export type TrainerState = {
  skillProgress: Record<SkillId, SkillProgress>;
  problemStats: Record<string, ProblemStats>;
  selectedSkill: SelectedSkill | null;
  streak: StreakState;
  aggregates: AggregateStats;
};

export type ProgressionResult = {
  nextLevel: number;
  leveledUp: boolean;
  masteredLevel: number | null;
};
