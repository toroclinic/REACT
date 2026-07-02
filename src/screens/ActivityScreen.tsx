import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  Platform,
  ScrollView,
  FlatList,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import { useEngagementStore } from '../store/engagementStore';
import { PricingApi } from '../services/api';
import { ActivityHistoryEntry } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';
import {
  isWatchSyncAvailable,
  syncWatchSessions,
} from '../services/healthConnect';

type ActivityTab = 'week' | 'history';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const HEALTH_CONNECT_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

function fmtActivityDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function groupByMonth(
  entries: ActivityHistoryEntry[],
): { month: string; entries: ActivityHistoryEntry[] }[] {
  const groups: Map<string, ActivityHistoryEntry[]> = new Map();
  for (const e of entries) {
    const key = e.date.slice(0, 7); // YYYY-MM
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(e);
  }
  return Array.from(groups.entries())
    .map(([month, es]) => ({
      month: new Date(month + '-01').toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      }),
      entries: es,
    }))
    .reverse();
}

// Current streak: consecutive days with ≥1 check-in, ending today or
// yesterday (so the streak survives until the member logs today).
// Ported from the Web PWA, with its walk-start bug fixed: the walk begins
// at yesterday when today has no entry yet, instead of always at today.
function computeStreak(entries: ActivityHistoryEntry[]): number {
  if (entries.length === 0) {
    return 0;
  }
  const days = new Set(entries.filter(e => e.count > 0).map(e => e.date));
  const cursor = new Date();
  const todayKey = cursor.toLocaleDateString('en-CA');
  if (!days.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.toLocaleDateString('en-CA'))) {
      return 0;
    }
  }
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    if (!days.has(cursor.toLocaleDateString('en-CA'))) {
      break;
    }
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function ActivityScreen() {
  const memberId = useAuthStore(s => s.memberId);
  const { profile, logEvent, refreshFromServer } = useEngagementStore();

  const [tab, setTab] = useState<ActivityTab>('week');
  const [hcAvailable, setHcAvailable] = useState<boolean | null>(null); // null = checking
  const [checkingIn, setCheckingIn] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const retryInFlight = useRef(false);

  const [activityHistory, setActivityHistory] = useState<
    ActivityHistoryEntry[]
  >([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const loadActivityHistory = useCallback(async () => {
    if (!memberId || historyLoaded) {
      return;
    }
    setLoadingHistory(true);
    try {
      const data = await PricingApi.getActivityHistory(memberId);
      setActivityHistory(data);
      setHistoryLoaded(true);
    } catch {
      /* silently fail */
    } finally {
      setLoadingHistory(false);
    }
  }, [memberId, historyLoaded]);

  useEffect(() => {
    isWatchSyncAvailable()
      .then(setHcAvailable)
      .catch(() => setHcAvailable(false));
  }, []);

  const historyGroups = useMemo(
    () => groupByMonth(activityHistory),
    [activityHistory],
  );
  const streak = useMemo(
    () => computeStreak(activityHistory),
    [activityHistory],
  );

  if (!profile) {
    return null;
  }

  const checkins = profile.activity_checkins_this_cycle;
  const todayIndex = (new Date().getDay() + 6) % 7;

  const handleTabChange = (t: ActivityTab) => {
    setTab(t);
    if (t === 'history') {
      void loadActivityHistory();
    }
  };

  const logToday = async () => {
    if (!memberId || checkingIn) {
      return;
    }
    setCheckingIn(true);
    try {
      await logEvent(memberId, 'activity_checkin', profile.chronic_member);
    } finally {
      setCheckingIn(false);
    }
  };

  const syncFromWatch = async () => {
    if (!memberId || syncing) {
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const count = await syncWatchSessions(memberId);
      setSyncResult(
        count > 0
          ? `${count} session${count !== 1 ? 's' : ''} synced from your watch.`
          : 'No new sessions found in the last 7 days.',
      );
      if (count > 0) {
        void refreshFromServer(memberId);
      }
    } catch (e: any) {
      if (e?.message === 'permission_denied') {
        setSyncResult(
          'Permission denied — open Health Connect and allow Wellness+ access.',
        );
      } else {
        setSyncResult('Sync failed. Please try again.');
      }
    } finally {
      setSyncing(false);
    }
  };

  const openHealthConnect = () => {
    Linking.openURL(HEALTH_CONNECT_PLAY_URL).catch(() => null);
  };

  // Re-check availability after user might have installed Health Connect
  const retryAvailability = () => {
    if (retryInFlight.current) {
      return;
    }
    retryInFlight.current = true;
    setHcAvailable(null);
    isWatchSyncAvailable().then(v => {
      setHcAvailable(v);
      retryInFlight.current = false;
    });
  };

  const isAndroid = Platform.OS === 'android';

  const renderHistoryGroup = ({
    item,
  }: {
    item: { month: string; entries: ActivityHistoryEntry[] };
  }) => (
    <View style={styles.historyGroup}>
      <Text style={styles.historyMonth}>{item.month}</Text>
      {item.entries.map(e => (
        <View key={e.date} style={styles.historyRow}>
          <View style={styles.historyDot} />
          <View style={styles.historyRowContent}>
            <Text style={styles.historyDate}>{fmtActivityDate(e.date)}</Text>
            <Text style={styles.historyMeta}>
              {e.count} check-in{e.count !== 1 ? 's' : ''}
              {e.minutes > 0 ? ` · ${e.minutes} min` : ''}
            </Text>
          </View>
          <Icon name="check-circle" size={16} color={colors.primaryTeal} />
        </View>
      ))}
    </View>
  );

  return (
    <View style={styles.screen}>
      {/* Tab selector */}
      <View style={styles.tabStrip}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'week' && styles.tabBtnActive]}
          onPress={() => handleTabChange('week')}
        >
          <Text
            style={[
              styles.tabBtnText,
              tab === 'week' && styles.tabBtnTextActive,
            ]}
          >
            This week
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}
          onPress={() => handleTabChange('history')}
        >
          <Text
            style={[
              styles.tabBtnText,
              tab === 'history' && styles.tabBtnTextActive,
            ]}
          >
            History
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'history' ? (
        loadingHistory ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primaryTeal} />
          </View>
        ) : (
          <FlatList
            style={styles.historyFlatList}
            data={historyGroups}
            keyExtractor={g => g.month}
            renderItem={renderHistoryGroup}
            contentContainerStyle={styles.historyList}
            removeClippedSubviews
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            ListHeaderComponent={
              activityHistory.length > 0 ? (
                <View style={styles.streakCard}>
                  <Text style={styles.streakEmoji}>
                    {streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : '🌱'}
                  </Text>
                  <View>
                    <Text style={styles.streakValue}>
                      {streak} day{streak !== 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.streakLabel}>
                      {streak > 0
                        ? 'Current streak — keep it going!'
                        : 'Log an activity today to start a streak'}
                    </Text>
                  </View>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyIcon}>🏃</Text>
                <Text style={styles.emptyTitle}>No activity history yet</Text>
                <Text style={styles.emptyBody}>
                  Start logging activity to build your history.
                </Text>
              </View>
            }
          />
        )
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.content}
        >
          <Text style={styles.title}>This week's activity</Text>
          <Text style={styles.subtitle}>
            {checkins} of 4 check-ins logged this cycle — extra days still build
            your streak.
          </Text>

          {/* 7-day grid */}
          <View style={styles.weekRow} accessible={false}>
            {DAY_LABELS.map((label, i) => {
              const on = i < checkins;
              const isToday = i === todayIndex;
              const dayName = [
                'Monday',
                'Tuesday',
                'Wednesday',
                'Thursday',
                'Friday',
                'Saturday',
                'Sunday',
              ][i];
              return (
                <View
                  key={i}
                  style={styles.dayColumn}
                  accessible
                  accessibilityLabel={`${dayName}: ${
                    on
                      ? 'logged'
                      : isToday
                      ? 'today, not yet logged'
                      : 'not logged'
                  }`}
                >
                  <View
                    style={[
                      styles.dot,
                      on && styles.dotOn,
                      isToday && !on && styles.dotToday,
                    ]}
                  >
                    {on && <Icon name="check" size={16} color={colors.white} />}
                    {isToday && !on && (
                      <Icon
                        name="circle-medium"
                        size={16}
                        color={colors.primaryTeal}
                      />
                    )}
                  </View>
                  <Text
                    style={[styles.dayLabel, isToday && styles.dayLabelToday]}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Manual check-in */}
          <TouchableOpacity
            style={[styles.logBtn, checkingIn && styles.logBtnDisabled]}
            onPress={logToday}
            disabled={checkingIn}
            accessibilityRole="button"
            accessibilityLabel="Log today's physical activity"
            accessibilityHint="Adds one activity check-in for today"
            accessibilityState={{ busy: checkingIn }}
          >
            {checkingIn ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Icon name="plus-circle-outline" size={18} color={colors.white} />
            )}
            <Text style={styles.logBtnText}>
              {checkingIn ? 'Logging…' : "Log today's activity"}
            </Text>
          </TouchableOpacity>

          {/* Watch sync card — always visible */}
          <View style={styles.watchCard}>
            <View style={styles.watchCardHeader}>
              <Icon name="watch-variant" size={20} color={colors.primaryTeal} />
              <Text style={styles.watchCardTitle}>Sync from watch</Text>
            </View>
            <Text style={styles.watchCardBody}>
              {isAndroid
                ? 'Automatically import workouts, SpO₂ readings, and sleep data from Wear OS, Galaxy Watch, Fitbit, or Garmin via Health Connect.'
                : 'Automatically import workouts, SpO₂, and sleep from Apple Watch via HealthKit.'}
            </Text>

            {/* Checking availability */}
            {hcAvailable === null && (
              <View style={styles.checkingRow}>
                <ActivityIndicator size="small" color={colors.primaryTeal} />
                <Text style={styles.checkingText}>Checking availability…</Text>
              </View>
            )}

            {/* Available — show sync button */}
            {hcAvailable === true && (
              <TouchableOpacity
                style={[styles.syncBtn, syncing && styles.syncBtnDisabled]}
                onPress={syncFromWatch}
                disabled={syncing}
                accessibilityRole="button"
                accessibilityLabel={
                  syncing ? 'Syncing from watch' : 'Sync workouts from watch'
                }
                accessibilityHint="Imports recent sessions from Health Connect"
                accessibilityState={{ disabled: syncing }}
              >
                {syncing ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Icon name="sync" size={16} color={colors.white} />
                )}
                <Text style={styles.syncBtnText}>
                  {syncing ? 'Syncing…' : 'Sync now'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Android: Health Connect not installed */}
            {hcAvailable === false && isAndroid && (
              <View style={styles.unavailableBox}>
                <Text style={styles.unavailableText}>
                  Health Connect is not installed on this device. Install it
                  from the Play Store, then come back and sync.
                </Text>
                <View style={styles.unavailableActions}>
                  <TouchableOpacity
                    style={styles.installBtn}
                    onPress={openHealthConnect}
                  >
                    <Icon name="google-play" size={14} color={colors.white} />
                    <Text style={styles.installBtnText}>
                      Install Health Connect
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={retryAvailability}
                  >
                    <Text style={styles.retryBtnText}>I've installed it →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* iOS: HealthKit always available but shown just in case */}
            {hcAvailable === false && !isAndroid && (
              <View style={styles.unavailableBox}>
                <Text style={styles.unavailableText}>
                  HealthKit is not available on this device. This feature
                  requires iOS 13+ on a physical iPhone.
                </Text>
              </View>
            )}

            {/* Sync result message */}
            {syncResult && (
              <View
                style={[
                  styles.resultBox,
                  syncResult.includes('denied') || syncResult.includes('failed')
                    ? styles.resultBoxError
                    : styles.resultBoxSuccess,
                ]}
              >
                <Icon
                  name={
                    syncResult.includes('denied') ||
                    syncResult.includes('failed')
                      ? 'alert-circle-outline'
                      : 'check-circle-outline'
                  }
                  size={14}
                  color={
                    syncResult.includes('denied') ||
                    syncResult.includes('failed')
                      ? '#DC2626'
                      : '#16A34A'
                  }
                />
                <Text
                  style={[
                    styles.resultText,
                    syncResult.includes('denied') ||
                    syncResult.includes('failed')
                      ? styles.resultTextError
                      : styles.resultTextSuccess,
                  ]}
                >
                  {syncResult}
                </Text>
              </View>
            )}

            {/* Supported devices list */}
            <View style={styles.supportedRow}>
              <Icon
                name="information-outline"
                size={12}
                color={colors.textTertiary}
              />
              <Text style={styles.supportedText}>
                {isAndroid
                  ? 'Supports Wear OS, Samsung Galaxy Watch, Fitbit, Garmin'
                  : 'Supports Apple Watch Series 1+'}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  scrollArea: { flex: 1 },
  content: {
    padding: spacing.lg + 2,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },

  // Tab strip
  tabStrip: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.screenBg,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  tabBtnActive: { borderBottomColor: colors.primaryTeal },
  tabBtnText: { ...typography.bodySmall, color: colors.textSecondary },
  tabBtnTextActive: { color: colors.primaryTeal, fontWeight: '600' as const },

  // History tab
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  historyFlatList: { flex: 1 },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  streakEmoji: { fontSize: 28 },
  streakValue: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700' as const,
  },
  streakLabel: { ...typography.caption, color: colors.textTertiary },
  historyList: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  historyGroup: { gap: spacing.sm },
  historyMonth: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primaryTeal,
  },
  historyRowContent: { flex: 1 },
  historyDate: { ...typography.bodySmall, color: colors.textPrimary },
  historyMeta: { ...typography.caption, color: colors.textTertiary },
  emptyWrap: { alignItems: 'center', paddingTop: spacing.xl * 3 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.md },
  emptyTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptyBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayColumn: { alignItems: 'center', gap: spacing.xs + 2 },
  dot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceNeutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOn: { backgroundColor: colors.primaryTeal },
  dotToday: { borderWidth: 2, borderColor: colors.primaryTeal },
  dayLabel: { ...typography.caption, color: colors.textTertiary },
  dayLabelToday: { color: colors.primaryTeal, fontWeight: '600' },

  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    minHeight: 50,
  },
  logBtnDisabled: { opacity: 0.6 },
  logBtnText: { ...typography.body, fontWeight: '600', color: colors.white },

  watchCard: {
    borderWidth: 1,
    borderColor: colors.toroBorder,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: colors.surfaceNeutral,
  },
  watchCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  watchCardTitle: { ...typography.h3, color: colors.textPrimary },
  watchCardBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  checkingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkingText: { ...typography.caption, color: colors.textTertiary },

  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.white,
  },

  unavailableBox: { gap: spacing.sm },
  unavailableText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  unavailableActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: colors.toroInk,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
  },
  installBtnText: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.white,
  },
  retryBtn: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm },
  retryBtnText: { ...typography.caption, color: colors.primaryTeal },

  resultBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 2,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
  },
  resultBoxSuccess: { backgroundColor: colors.successBg },
  resultBoxError: { backgroundColor: colors.dangerBg },
  resultText: { ...typography.caption, flex: 1 },
  resultTextSuccess: { color: colors.successText },
  resultTextError: { color: colors.dangerText },

  supportedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingTop: spacing.xs,
  },
  supportedText: { ...typography.caption, color: colors.textTertiary },
});
