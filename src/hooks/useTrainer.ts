import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { selectNextQuestion } from '@/engine/adaptiveSelector';
import { getQuestionPrompt, getProblemKey } from '@/engine/questionGenerator';
import { SKILL_IDS } from '@/engine/skills';
import { updateSkillProgress } from '@/engine/progression';
import { MAX_RECENT_ATTEMPTS, updateProblemStats } from '@/engine/statistics';
import { createDefaultTrainerState, loadTrainerState, saveTrainerState } from '@/storage/storage';
import { AnswerRecord, Question, SelectedSkill, TrainerState } from '@/types/game';
import { getLocalDateString, isSameDay, isYesterday } from '@/utils/dates';

const FEEDBACK_DELAY_MS = 650;
const RECENT_QUESTION_MEMORY = 6;

type FeedbackState = {
  correct: boolean;
  durationMs: number;
  answer: number;
  levelUpText: string | null;
} | null;

function sanitizeAnswerInput(value: string) {
  const cleaned = value.replace(/[^\d-]/g, '');
  const isNegative = cleaned.startsWith('-');
  const digits = cleaned.replace(/-/g, '');
  return `${isNegative ? '-' : ''}${digits}`;
}

function updateStreak(state: TrainerState): TrainerState {
  const today = getLocalDateString();
  const lastActiveDate = state.streak.lastActiveDate;
  const sameDay = isSameDay(lastActiveDate, today);
  const nextDailyQuestionsAnswered = sameDay ? state.streak.dailyQuestionsAnswered + 1 : 1;
  let nextCurrentStreak = state.streak.currentStreak;

  if (!lastActiveDate) {
    nextCurrentStreak = 1;
  } else if (sameDay) {
    nextCurrentStreak = state.streak.currentStreak;
  } else if (isYesterday(lastActiveDate, today)) {
    nextCurrentStreak = state.streak.currentStreak + 1;
  } else {
    nextCurrentStreak = 1;
  }

  return {
    ...state,
    streak: {
      ...state.streak,
      currentStreak: nextCurrentStreak,
      longestStreak: Math.max(state.streak.longestStreak, nextCurrentStreak),
      lastActiveDate: today,
      dailyQuestionsAnswered: nextDailyQuestionsAnswered,
    },
  };
}

export function useTrainer() {
  const [state, setState] = useState<TrainerState>(() => createDefaultTrainerState());
  const [loaded, setLoaded] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [recentAnswers, setRecentAnswers] = useState<AnswerRecord[]>([]);
  const [levelUpText, setLevelUpText] = useState<string | null>(null);
  const startTimeRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recentQuestionIdsRef = useRef<string[]>([]);

  const selectedSkill = state.selectedSkill;
  const canTrain = selectedSkill !== null;

  const visibleAccuracy = useMemo(() => {
    if (state.aggregates.totalAnswered === 0) return 0;
    return Math.round((state.aggregates.totalCorrect / state.aggregates.totalAnswered) * 100);
  }, [state.aggregates.totalAnswered, state.aggregates.totalCorrect]);

  const persist = useCallback((nextState: TrainerState) => {
    void saveTrainerState(nextState);
  }, []);

  const generateNext = useCallback(
    (nextState: TrainerState) => {
      if (!nextState.selectedSkill) return;

      const nextQuestion = selectNextQuestion({
        selectedSkill: nextState.selectedSkill,
        skillProgress: nextState.skillProgress,
        problemStats: nextState.problemStats,
        recentQuestionIds: recentQuestionIdsRef.current,
      });

      setCurrentQuestion(nextQuestion);
      setAnswer('');
      setFeedback(null);
      startTimeRef.current = performance.now();
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    loadTrainerState().then((storedState) => {
      if (!mounted) return;

      setState(storedState);
      setLoaded(true);
      if (storedState.selectedSkill) {
        generateNext(storedState);
      }
    });

    return () => {
      mounted = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [generateNext]);

  const chooseSkill = useCallback(
    (selected: SelectedSkill) => {
      const nextState = {
        ...state,
        selectedSkill: selected,
      };

      setState(nextState);
      persist(nextState);
      generateNext(nextState);
    },
    [generateNext, persist, state],
  );

  const changeSkill = useCallback(
    (selected: SelectedSkill) => {
      recentQuestionIdsRef.current = [];
      chooseSkill(selected);
    },
    [chooseSkill],
  );

  const updateAnswer = useCallback((value: string) => {
    setAnswer(sanitizeAnswerInput(value));
  }, []);

  const submit = useCallback(() => {
    if (!currentQuestion || feedback) return;

    const trimmed = answer.trim();
    if (!trimmed || trimmed === '-') {
      setAnswer('');
      return;
    }

    const userAnswer = Number(trimmed);
    if (!Number.isFinite(userAnswer)) {
      setAnswer('');
      return;
    }

    const durationMs = performance.now() - startTimeRef.current;
    const correct = userAnswer === currentQuestion.answer;
    const attempt = {
      questionId: currentQuestion.id,
      skill: currentQuestion.skill,
      level: currentQuestion.level,
      correct,
      durationMs,
      timestamp: Date.now(),
    };
    const answerRecord: AnswerRecord = {
      ...attempt,
      prompt: getQuestionPrompt(currentQuestion),
      userAnswer,
      answer: currentQuestion.answer,
    };
    const problemKey = getProblemKey(currentQuestion);
    const updatedSkill = updateSkillProgress(state.skillProgress[currentQuestion.skill], attempt);
    const skillProgress = {
      ...state.skillProgress,
      [currentQuestion.skill]: updatedSkill.progress,
    };
    const withAttempt: TrainerState = updateStreak({
      ...state,
      skillProgress,
      problemStats: {
        ...state.problemStats,
        [problemKey]: updateProblemStats(state.problemStats[problemKey], correct, durationMs),
      },
      aggregates: {
        totalAnswered: state.aggregates.totalAnswered + 1,
        totalCorrect: state.aggregates.totalCorrect + (correct ? 1 : 0),
        recentAttempts: [attempt, ...state.aggregates.recentAttempts].slice(0, MAX_RECENT_ATTEMPTS),
      },
    });
    const levelUp = updatedSkill.progression.leveledUp
      ? `${currentQuestion.skill[0].toUpperCase()}${currentQuestion.skill.slice(1)} ${updatedSkill.progression.masteredLevel} → ${updatedSkill.progression.nextLevel}`
      : null;

    recentQuestionIdsRef.current = [currentQuestion.id, ...recentQuestionIdsRef.current].slice(
      0,
      RECENT_QUESTION_MEMORY,
    );

    setState(withAttempt);
    setRecentAnswers((records) => [answerRecord, ...records].slice(0, 7));
    setFeedback({ correct, durationMs, answer: currentQuestion.answer, levelUpText: levelUp });
    setLevelUpText(levelUp);
    persist(withAttempt);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      setLevelUpText(null);
      generateNext(withAttempt);
    }, FEEDBACK_DELAY_MS);
  }, [answer, currentQuestion, feedback, generateNext, persist, state]);

  return {
    answer,
    canTrain,
    changeSkill,
    chooseSkill,
    currentQuestion,
    feedback,
    levelUpText,
    loaded,
    recentAnswers,
    selectedSkill,
    setAnswer: updateAnswer,
    skillIds: SKILL_IDS,
    state,
    submit,
    visibleAccuracy,
  };
}
