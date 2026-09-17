import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getQuestionPrompt } from '@/engine/questionGenerator';
import { SKILL_NAMES } from '@/engine/skills';
import { summarizeAttempts } from '@/engine/statistics';
import { useTrainer } from '@/hooks/useTrainer';
import { SelectedSkill, SkillId } from '@/types/game';
import { median } from '@/utils/median';

const palette = {
  background: '#000000',
  surface: 'rgba(255,255,255,0.06)',
  surfaceStrong: 'rgba(255,255,255,0.11)',
  border: 'rgba(255,255,255,0.12)',
  text: '#FFFFFF',
  secondaryText: 'rgba(255,255,255,0.58)',
  mutedText: 'rgba(255,255,255,0.34)',
  success: '#30D158',
  error: '#FF453A',
  warning: '#FF9F0A',
};

function formatSeconds(durationMs: number) {
  return `${(durationMs / 1000).toFixed(2)}s`;
}

function getSkillLabel(selectedSkill: SelectedSkill | null) {
  if (!selectedSkill) return 'Choose';
  if (selectedSkill === 'all') return 'All Skills';
  return SKILL_NAMES[selectedSkill];
}

export default function TrainerScreen() {
  const inputRef = useRef<TextInput>(null);
  const [feedbackOpacity] = useState(() => new Animated.Value(0));
  const [feedbackScale] = useState(() => new Animated.Value(0.96));
  const [levelScale] = useState(() => new Animated.Value(0.98));
  const [showStats, setShowStats] = useState(false);
  const trainer = useTrainer();

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    if (trainer.currentQuestion && !showStats) {
      focusInput();
    }
  }, [focusInput, showStats, trainer.currentQuestion]);

  useEffect(() => {
    if (!trainer.feedback) return;

    feedbackOpacity.setValue(0);
    feedbackScale.setValue(0.96);
    Animated.parallel([
      Animated.timing(feedbackOpacity, {
        toValue: 1,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.spring(feedbackScale, {
        toValue: 1,
        speed: 24,
        bounciness: 5,
        useNativeDriver: true,
      }),
    ]).start();
  }, [feedbackOpacity, feedbackScale, trainer.feedback]);

  useEffect(() => {
    if (!trainer.levelUpText) return;

    levelScale.setValue(0.98);
    Animated.sequence([
      Animated.spring(levelScale, {
        toValue: 1.04,
        speed: 22,
        bounciness: 7,
        useNativeDriver: true,
      }),
      Animated.spring(levelScale, {
        toValue: 1,
        speed: 22,
        bounciness: 6,
        useNativeDriver: true,
      }),
    ]).start();
  }, [levelScale, trainer.levelUpText]);

  if (!trainer.loaded) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.loadingWrap}>
          <Text style={styles.loadingText}>Loading trainer</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!trainer.canTrain) {
    return (
      <SafeAreaView style={styles.screen}>
        <BackgroundGlass />
        <View style={styles.firstLaunch}>
          <Text style={styles.firstLaunchTitle}>Choose your first training skill</Text>
          <Text style={styles.firstLaunchCopy}>Start focused or let the trainer adapt across all skills.</Text>
          <SkillPicker selectedSkill={trainer.selectedSkill} onSelect={trainer.chooseSkill} large />
        </View>
      </SafeAreaView>
    );
  }

  if (showStats) {
    return (
      <StatsScreen
        onClose={() => {
          setShowStats(false);
          focusInput();
        }}
        trainer={trainer}
      />
    );
  }

  const questionPrompt = trainer.currentQuestion ? getQuestionPrompt(trainer.currentQuestion) : '';
  const dailyProgress = Math.min(
    1,
    trainer.state.streak.dailyQuestionsAnswered / trainer.state.streak.dailyGoal,
  );

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}>
        <BackgroundGlass />

        <View style={styles.appShell}>
          <View style={styles.header}>
            <View style={styles.streakBlock}>
              <Text style={styles.streakText}>🔥 {trainer.state.streak.currentStreak}</Text>
              <Text style={styles.headerLabel}>day streak</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open performance statistics"
              onPress={() => setShowStats(true)}
              style={styles.statsButton}>
              <Text style={styles.accuracyText}>{trainer.visibleAccuracy}%</Text>
              <Text style={styles.headerLabel}>stats</Text>
            </Pressable>
          </View>

          <View style={styles.modeRow}>
            <SkillPicker selectedSkill={trainer.selectedSkill} onSelect={trainer.changeSkill} />
          </View>

          <View style={styles.goalWrap}>
            <View style={styles.goalLine}>
              <Text style={styles.goalValue}>
                {trainer.state.streak.dailyQuestionsAnswered} / {trainer.state.streak.dailyGoal}
              </Text>
              <Text style={styles.goalLabel}>
                {dailyProgress >= 1 ? '✓ Daily goal complete' : 'daily goal'}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${dailyProgress * 100}%` }]} />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Focus answer input"
            onPress={focusInput}
            style={styles.questionArea}>
            <Text style={styles.skillContext}>
              {trainer.currentQuestion
                ? `${SKILL_NAMES[trainer.currentQuestion.skill]} · Level ${trainer.currentQuestion.level}`
                : getSkillLabel(trainer.selectedSkill)}
            </Text>

            <Text style={styles.questionText}>{questionPrompt}</Text>

            <View style={styles.inputWrap}>
              <TextInput
                ref={inputRef}
                value={trainer.answer}
                onChangeText={trainer.setAnswer}
                onSubmitEditing={trainer.submit}
                style={styles.answerInput}
                keyboardAppearance="dark"
                keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
                inputMode="numeric"
                returnKeyType="done"
                submitBehavior="submit"
                blurOnSubmit={false}
                autoCorrect={false}
                autoCapitalize="none"
                selectTextOnFocus
                placeholder="0"
                placeholderTextColor={palette.mutedText}
                accessibilityLabel="Answer"
              />
              <View
                style={[
                  styles.inputUnderline,
                  trainer.feedback?.correct === true && styles.successUnderline,
                  trainer.feedback?.correct === false && styles.errorUnderline,
                ]}
              />
            </View>

            <Animated.View
              style={[
                styles.feedbackArea,
                { opacity: feedbackOpacity, transform: [{ scale: feedbackScale }] },
              ]}>
              {trainer.feedback ? (
                <>
                  <Text
                    style={[
                      styles.feedbackText,
                      trainer.feedback.correct ? styles.successText : styles.errorText,
                    ]}>
                    {trainer.feedback.correct ? '✓ Correct' : '✕ Incorrect'}
                  </Text>
                  {!trainer.feedback.correct && (
                    <Text style={styles.answerReveal}>Answer: {trainer.feedback.answer}</Text>
                  )}
                  <Text style={styles.feedbackTime}>{formatSeconds(trainer.feedback.durationMs)}</Text>
                </>
              ) : (
                <Text style={styles.invisibleText}>.</Text>
              )}
            </Animated.View>

            {trainer.levelUpText ? (
              <Animated.View style={[styles.levelUpPill, { transform: [{ scale: levelScale }] }]}>
                <Text style={styles.levelUpKicker}>LEVEL UP</Text>
                <Text style={styles.levelUpText}>{trainer.levelUpText}</Text>
              </Animated.View>
            ) : null}
          </Pressable>

          <RecentAnswers records={trainer.recentAnswers.slice(0, 3)} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BackgroundGlass() {
  return (
    <>
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />
    </>
  );
}

function SkillPicker({
  large,
  onSelect,
  selectedSkill,
}: {
  large?: boolean;
  onSelect: (skill: SelectedSkill) => void;
  selectedSkill: SelectedSkill | null;
}) {
  const options: SelectedSkill[] = ['all', 'addition', 'subtraction', 'multiplication', 'division'];

  return (
    <View style={[styles.skillPicker, large && styles.skillPickerLarge]}>
      {options.map((option) => {
        const selected = selectedSkill === option;

        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onSelect(option)}
            style={[styles.skillChip, large && styles.skillChipLarge, selected && styles.skillChipSelected]}>
            <Text style={[styles.skillChipText, selected && styles.skillChipTextSelected]}>
              {getSkillLabel(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function RecentAnswers({ records }: { records: ReturnType<typeof useTrainer>['recentAnswers'] }) {
  if (records.length === 0) {
    return <Text style={styles.emptyHistory}>Answer with Done or Enter</Text>;
  }

  return (
    <View style={styles.recentRow}>
      {records.map((record) => (
        <View
          key={`${record.timestamp}-${record.questionId}`}
          style={[styles.historyChip, record.correct ? styles.historySuccess : styles.historyError]}>
          <Text style={[styles.historyText, record.correct ? styles.successText : styles.errorText]}>
            {record.correct ? '✓' : '✕'} {formatSeconds(record.durationMs)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function StatsScreen({
  onClose,
  trainer,
}: {
  onClose: () => void;
  trainer: ReturnType<typeof useTrainer>;
}) {
  const durations = trainer.state.aggregates.recentAttempts.map((attempt) => attempt.durationMs);
  const medianTime = median(durations);

  return (
    <SafeAreaView style={styles.screen}>
      <BackgroundGlass />
      <ScrollView contentContainerStyle={styles.statsShell}>
        <View style={styles.statsHeader}>
          <View>
            <Text style={styles.statsTitle}>Performance</Text>
            <Text style={styles.statsSubtitle}>Offline training history</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          <StatTile label="Questions" value={String(trainer.state.aggregates.totalAnswered)} />
          <StatTile label="Accuracy" value={`${trainer.visibleAccuracy}%`} />
          <StatTile label="Median" value={medianTime ? formatSeconds(medianTime) : '0.00s'} />
          <StatTile label="Best streak" value={String(trainer.state.streak.longestStreak)} />
        </View>

        <Text style={styles.sectionTitle}>Skills</Text>
        <View style={styles.skillsList}>
          {trainer.skillIds.map((skill) => (
            <SkillProgressRow
              key={skill}
              skill={skill}
              level={trainer.state.skillProgress[skill].level}
              summary={summarizeAttempts(trainer.state.skillProgress[skill].recentAttempts)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Recent Performance</Text>
        <View style={styles.timeline}>
          {trainer.recentAnswers.length === 0 ? (
            <Text style={styles.emptyTimeline}>No attempts yet</Text>
          ) : (
            trainer.recentAnswers.map((record) => (
              <View key={`${record.timestamp}-${record.questionId}`} style={styles.timelineItem}>
                <Text style={[styles.timelineMark, record.correct ? styles.successText : styles.errorText]}>
                  {record.correct ? '✓' : '✕'}
                </Text>
                <Text style={styles.timelineQuestion}>{record.prompt}</Text>
                <Text style={styles.timelineTime}>{formatSeconds(record.durationMs)}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statTile}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SkillProgressRow({
  level,
  skill,
  summary,
}: {
  level: number;
  skill: SkillId;
  summary: { attempts: number; accuracy: number; medianTimeMs: number };
}) {
  return (
    <View style={styles.skillProgressRow}>
      <View style={styles.skillProgressTop}>
        <Text style={styles.skillName}>{SKILL_NAMES[skill]}</Text>
        <Text style={styles.skillLevel}>Level {level}</Text>
      </View>
      <View style={styles.skillProgressTrack}>
        <View style={[styles.skillProgressFill, { width: `${level}%` }]} />
      </View>
      <Text style={styles.skillMeta}>
        {summary.attempts} recent · {Math.round(summary.accuracy * 100)}% ·{' '}
        {summary.medianTimeMs ? formatSeconds(summary.medianTimeMs) : '0.00s'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.background,
  },
  keyboardView: {
    flex: 1,
  },
  appShell: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 540,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 24,
    justifyContent: 'space-between',
  },
  backgroundGlowTop: {
    position: 'absolute',
    top: -96,
    right: -110,
    width: 270,
    height: 270,
    borderRadius: 135,
    backgroundColor: 'rgba(48,209,88,0.10)',
  },
  backgroundGlowBottom: {
    position: 'absolute',
    bottom: -130,
    left: -130,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255,159,10,0.08)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  streakBlock: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    minWidth: 124,
  },
  streakText: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '900',
  },
  headerLabel: {
    color: palette.secondaryText,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statsButton: {
    alignItems: 'flex-end',
    padding: 8,
  },
  accuracyText: {
    color: palette.text,
    fontSize: 27,
    fontWeight: '900',
  },
  modeRow: {
    marginTop: 14,
  },
  skillPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  skillPickerLarge: {
    alignSelf: 'stretch',
    marginTop: 24,
  },
  skillChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  skillChipLarge: {
    minWidth: 132,
    alignItems: 'center',
    paddingVertical: 12,
  },
  skillChipSelected: {
    backgroundColor: palette.surfaceStrong,
    borderColor: 'rgba(48,209,88,0.34)',
  },
  skillChipText: {
    color: palette.secondaryText,
    fontSize: 13,
    fontWeight: '800',
  },
  skillChipTextSelected: {
    color: palette.text,
  },
  goalWrap: {
    marginTop: 16,
    gap: 9,
  },
  goalLine: {
    alignItems: 'center',
  },
  goalValue: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '900',
  },
  goalLabel: {
    color: palette.secondaryText,
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 7,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: palette.success,
  },
  questionArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    minHeight: 350,
  },
  skillContext: {
    color: palette.secondaryText,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 12,
  },
  questionText: {
    color: palette.text,
    fontSize: 62,
    lineHeight: 74,
    fontWeight: '900',
    textAlign: 'center',
  },
  inputWrap: {
    marginTop: 22,
    alignItems: 'center',
    minWidth: 170,
  },
  answerInput: {
    color: palette.text,
    fontSize: 38,
    lineHeight: 46,
    fontWeight: '900',
    textAlign: 'center',
    minWidth: 170,
    maxWidth: 260,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  inputUnderline: {
    width: 184,
    height: 2,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  successUnderline: {
    backgroundColor: palette.success,
    shadowColor: palette.success,
  },
  errorUnderline: {
    backgroundColor: palette.error,
    shadowColor: palette.error,
  },
  feedbackArea: {
    minHeight: 88,
    marginTop: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackText: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  answerReveal: {
    color: palette.text,
    marginTop: 4,
    fontSize: 16,
    fontWeight: '800',
  },
  feedbackTime: {
    color: palette.secondaryText,
    marginTop: 4,
    fontSize: 17,
    fontWeight: '800',
  },
  invisibleText: {
    color: 'transparent',
  },
  successText: {
    color: palette.success,
  },
  errorText: {
    color: palette.error,
  },
  levelUpPill: {
    position: 'absolute',
    bottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.28)',
    backgroundColor: 'rgba(48,209,88,0.10)',
    alignItems: 'center',
  },
  levelUpKicker: {
    color: palette.success,
    fontSize: 11,
    fontWeight: '900',
  },
  levelUpText: {
    color: palette.text,
    marginTop: 2,
    fontSize: 14,
    fontWeight: '900',
  },
  recentRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  emptyHistory: {
    color: palette.mutedText,
    textAlign: 'center',
    minHeight: 48,
    fontSize: 14,
    fontWeight: '700',
  },
  historyChip: {
    minWidth: 82,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 19,
    borderWidth: 1,
    backgroundColor: palette.surface,
    alignItems: 'center',
  },
  historySuccess: {
    borderColor: 'rgba(48,209,88,0.24)',
  },
  historyError: {
    borderColor: 'rgba(255,69,58,0.30)',
  },
  historyText: {
    fontSize: 14,
    fontWeight: '900',
  },
  firstLaunch: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  firstLaunchTitle: {
    color: palette.text,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
    textAlign: 'center',
  },
  firstLaunchCopy: {
    color: palette.secondaryText,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: palette.secondaryText,
    fontSize: 16,
    fontWeight: '800',
  },
  statsShell: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 560,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 34,
    gap: 18,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
  },
  statsTitle: {
    color: palette.text,
    fontSize: 30,
    fontWeight: '900',
  },
  statsSubtitle: {
    color: palette.secondaryText,
    marginTop: 2,
    fontSize: 14,
    fontWeight: '700',
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  closeText: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: '46%',
    padding: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  statValue: {
    color: palette.text,
    fontSize: 25,
    fontWeight: '900',
  },
  statLabel: {
    color: palette.secondaryText,
    marginTop: 3,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 4,
  },
  skillsList: {
    gap: 10,
  },
  skillProgressRow: {
    padding: 15,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    gap: 9,
  },
  skillProgressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  skillName: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '900',
  },
  skillLevel: {
    color: palette.secondaryText,
    fontSize: 14,
    fontWeight: '800',
  },
  skillProgressTrack: {
    height: 8,
    borderRadius: 99,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skillProgressFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: palette.success,
  },
  skillMeta: {
    color: palette.secondaryText,
    fontSize: 12,
    fontWeight: '700',
  },
  timeline: {
    gap: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  timelineMark: {
    width: 18,
    fontSize: 16,
    fontWeight: '900',
  },
  timelineQuestion: {
    flex: 1,
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  timelineTime: {
    color: palette.secondaryText,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyTimeline: {
    color: palette.secondaryText,
    fontSize: 14,
    fontWeight: '700',
  },
});
