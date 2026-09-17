import AsyncStorage from "@react-native-async-storage/async-storage";

import { SKILL_IDS } from "@/engine/skills";
import {
    AggregateStats,
    ProblemStats,
    SelectedSkill,
    SkillId,
    SkillProgress,
    TrainerState,
} from "@/types/game";
import { getLocalDateString, isSameDay, isYesterday } from "@/utils/dates";

export const STORAGE_VERSION = 1;
const STORAGE_KEY = "mathraga:trainer-state:v1";
const DEFAULT_DAILY_GOAL = 20;

type PersistedTrainerState = TrainerState & {
    version: number;
};

function createSkillProgress(): SkillProgress {
    return {
        level: 1,
        attempts: 0,
        correct: 0,
        recentAttempts: [],
        masteredLevels: [],
    };
}

export function createDefaultSkillProgress(): Record<SkillId, SkillProgress> {
    return {
        addition: createSkillProgress(),
        subtraction: createSkillProgress(),
        multiplication: createSkillProgress(),
        division: createSkillProgress(),
    };
}

export function createDefaultTrainerState(): TrainerState {
    return {
        skillProgress: createDefaultSkillProgress(),
        problemStats: {},
        selectedSkill: null,
        streak: {
            currentStreak: 0,
            longestStreak: 0,
            lastActiveDate: null,
            dailyQuestionsAnswered: 0,
            dailyGoal: DEFAULT_DAILY_GOAL,
        },
        aggregates: {
            totalAnswered: 0,
            totalCorrect: 0,
            totalMentalLoad: 0,
            recentAttempts: [],
        },
    };
}

function isProblemStatsMap(
    value: unknown,
): value is Record<string, ProblemStats> {
    return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeSelectedSkill(value: unknown): SelectedSkill | null {
    if (value === "all") return value;
    if (typeof value === "string" && SKILL_IDS.includes(value as SkillId))
        return value as SkillId;
    return null;
}

function normalizeAggregates(
    value: Partial<AggregateStats> | undefined,
): AggregateStats {
    return {
        totalAnswered:
            typeof value?.totalAnswered === "number" ? value.totalAnswered : 0,
        totalCorrect:
            typeof value?.totalCorrect === "number" ? value.totalCorrect : 0,
        totalMentalLoad:
            typeof value?.totalMentalLoad === "number"
                ? value.totalMentalLoad
                : 0,
        recentAttempts: Array.isArray(value?.recentAttempts)
            ? value.recentAttempts.slice(0, 120)
            : [],
    };
}

function normalizeState(value: Partial<PersistedTrainerState>): TrainerState {
    const defaults = createDefaultTrainerState();
    const today = getLocalDateString();
    const lastActiveDate =
        typeof value.streak?.lastActiveDate === "string"
            ? value.streak.lastActiveDate
            : null;
    const streakStillCurrent =
        !lastActiveDate ||
        isSameDay(lastActiveDate, today) ||
        isYesterday(lastActiveDate, today);

    return {
        skillProgress: SKILL_IDS.reduce<Record<SkillId, SkillProgress>>(
            (progressMap, skill) => {
                const existing = value.skillProgress?.[skill];
                progressMap[skill] = {
                    level: Math.min(
                        100,
                        Math.max(
                            1,
                            existing?.level ??
                                defaults.skillProgress[skill].level,
                        ),
                    ),
                    attempts: existing?.attempts ?? 0,
                    correct: existing?.correct ?? 0,
                    recentAttempts: Array.isArray(existing?.recentAttempts)
                        ? existing.recentAttempts.slice(0, 80)
                        : [],
                    masteredLevels: Array.isArray(existing?.masteredLevels)
                        ? existing.masteredLevels.slice(-100)
                        : [],
                };
                return progressMap;
            },
            createDefaultSkillProgress(),
        ),
        problemStats: isProblemStatsMap(value.problemStats)
            ? value.problemStats
            : {},
        selectedSkill: normalizeSelectedSkill(value.selectedSkill),
        streak: {
            currentStreak: streakStillCurrent
                ? (value.streak?.currentStreak ?? 0)
                : 0,
            longestStreak: value.streak?.longestStreak ?? 0,
            lastActiveDate,
            dailyQuestionsAnswered: isSameDay(lastActiveDate, today)
                ? (value.streak?.dailyQuestionsAnswered ?? 0)
                : 0,
            dailyGoal: Math.max(
                1,
                value.streak?.dailyGoal ?? DEFAULT_DAILY_GOAL,
            ),
        },
        aggregates: normalizeAggregates(value.aggregates),
    };
}

export async function loadTrainerState() {
    try {
        const storedValue = await AsyncStorage.getItem(STORAGE_KEY);
        if (!storedValue) return createDefaultTrainerState();

        const parsed = JSON.parse(
            storedValue,
        ) as Partial<PersistedTrainerState>;
        if (parsed.version !== STORAGE_VERSION)
            return createDefaultTrainerState();

        return normalizeState(parsed);
    } catch {
        return createDefaultTrainerState();
    }
}

export async function saveTrainerState(state: TrainerState) {
    const persisted: PersistedTrainerState = {
        ...state,
        version: STORAGE_VERSION,
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
}
