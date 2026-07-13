// Activity — mirrors the PWA's ActivityScreen structure exactly:
// stats row (streak + total sessions) → monthly calendar with the embedded
// log form (board ActivityCalendar) → watch-sync card. The old week-dots +
// separate History tab were replaced by the calendar, same as the PWA.
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
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import { useEngagementStore } from '../store/engagementStore';
import { PricingApi } from '../services/api';
import { ActivityHistoryEntry } from '../types/api';
import { colors, fonts, radius, spacing, typography } from '../theme/tokens';
import { ActivityCalendar, StreakBadge } from '../components/board';
import {
  isWatchSyncAvailable,
  syncWatchSessions,
} from '../services/healthConnect';

const HEALTH_CONNECT_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

// Current streak: consecutive days with ≥1 check-in, ending today or
// yesterday (so the streak survives until the member logs today). Same walk
// as the PWA's computeStreak.
function computeStreak(entries: ActivityHistoryEntry[]): number {
  if (entries.length === 0) {
    return 0;
  }
  const days = new Set(
    entries.map(e => new Date(e.logged_at).toLocaleDateString('en-CA')),
  );
  const cursor = new Date();
  if (!days.has(cursor.toLocaleDateString('en-CA'))) {
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
  const { profile, applyOptimisticUpdate, refreshFromServer } =
    useEngagementStore();

  const [hcAvailable, setHcAvailable] = useState<boolean | null>(null); // null = checking
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const retryInFlight = useRef(false);

  const [activityHistory, setActivityHistory] = useState<
    ActivityHistoryEntry[]
  >([]);

  const loadActivityHistory = useCallback(async () => {
    if (!memberId) {
      return;
    }
    try {
      const data = await PricingApi.getActivityHistory(memberId);
      setActivityHistory(data);
    } catch {
      /* silently fail — calendar just shows no markers */
    }
  }, [memberId]);

  useEffect(() => {
    void loadActivityHistory();
    isWatchSyncAvailable()
      .then(setHcAvailable)
      .catch(() => setHcAvailable(false));
  }, [loadActivityHistory]);

  const streak = useMemo(
    () => computeStreak(activityHistory),
    [activityHistory],
  );

  if (!profile) {
    return null;
  }

  const checkins = profile.activity_checkins_this_cycle;

  const onLogged = () => {
    void applyOptimisticUpdate({
      activity_checkins_this_cycle: checkins + 1,
    });
    if (memberId) {
      void refreshFromServer(memberId);
    }
    void loadActivityHistory();
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
        void loadActivityHistory();
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

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Activity</Text>
      <Text style={styles.subtitle}>
        {checkins} of 4 check-ins logged this cycle — extra days still build
        your streak.
      </Text>

      {/* Streak + total sessions — same stats row as the PWA */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{streak}</Text>
          {streak > 0 ? (
            <StreakBadge days={streak} />
          ) : (
            <Text style={styles.statLabel}>day streak</Text>
          )}
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activityHistory.length}</Text>
          <Text style={styles.statLabel}>total sessions</Text>
        </View>
      </View>

      {/* Monthly calendar — with embedded log form */}
      {memberId ? (
        <ActivityCalendar
          history={activityHistory}
          memberId={memberId}
          onLogged={onLogged}
        />
      ) : null}

      {/* Watch sync card */}
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
              Health Connect is not installed on this device. Install it from
              the Play Store, then come back and sync.
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
              HealthKit is not available on this device. This feature requires
              iOS 13+ on a physical iPhone.
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
                syncResult.includes('denied') || syncResult.includes('failed')
                  ? 'alert-circle-outline'
                  : 'check-circle-outline'
              }
              size={14}
              color={
                syncResult.includes('denied') || syncResult.includes('failed')
                  ? colors.dangerText
                  : colors.successText
              }
            />
            <Text
              style={[
                styles.resultText,
                syncResult.includes('denied') || syncResult.includes('failed')
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
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  content: {
    padding: spacing.lg + 2,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },

  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary },

  // Stats row — streak + total sessions (PWA .activity-stats-row)
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.toroBorder,
    paddingVertical: spacing.lg,
  },
  statValue: {
    fontSize: 26,
    fontFamily: fonts.display700,
    color: colors.textPrimary,
  },
  statLabel: { ...typography.caption, color: colors.textTertiary },

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
    backgroundColor: colors.pine, // dark action button (white text) on light UI
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
