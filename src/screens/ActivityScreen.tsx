import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Linking, Platform, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import { useEngagementStore } from '../store/engagementStore';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { isWatchSyncAvailable, syncWatchSessions } from '../services/healthConnect';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const todayIndex = (new Date().getDay() + 6) % 7;

const HEALTH_CONNECT_PLAY_URL =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';

export function ActivityScreen() {
  const memberId = useAuthStore((s) => s.memberId);
  const { profile, logEvent, refreshFromServer } = useEngagementStore();

  const [hcAvailable, setHcAvailable] = useState<boolean | null>(null); // null = checking
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  useEffect(() => {
    isWatchSyncAvailable().then(setHcAvailable);
  }, []);

  if (!profile) return null;

  const checkins = profile.activity_checkins_this_cycle;

  const logToday = async () => {
    if (!memberId) return;
    await logEvent(memberId, 'activity_checkin', profile.chronic_member);
  };

  const syncFromWatch = async () => {
    if (!memberId || syncing) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const count = await syncWatchSessions(memberId);
      setSyncResult(
        count > 0
          ? `${count} session${count !== 1 ? 's' : ''} synced from your watch.`
          : 'No new sessions found in the last 7 days.',
      );
      if (count > 0) void refreshFromServer(memberId);
    } catch (e: any) {
      if (e?.message === 'permission_denied') {
        setSyncResult('Permission denied — open Health Connect and allow Wellness+ access.');
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
    setHcAvailable(null);
    isWatchSyncAvailable().then(setHcAvailable);
  };

  const isAndroid = Platform.OS === 'android';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>This week's activity</Text>
      <Text style={styles.subtitle}>
        {checkins} of 4 check-ins logged this cycle — extra days still build your streak.
      </Text>

      {/* 7-day grid */}
      <View style={styles.weekRow}>
        {DAY_LABELS.map((label, i) => {
          const on = i < checkins;
          const isToday = i === todayIndex;
          return (
            <View key={i} style={styles.dayColumn}>
              <View style={[
                styles.dot,
                on && styles.dotOn,
                isToday && !on && styles.dotToday,
              ]}>
                {on && <Icon name="check" size={14} color={colors.white} />}
                {isToday && !on && <Icon name="circle-medium" size={14} color={colors.primaryTeal} />}
              </View>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{label}</Text>
            </View>
          );
        })}
      </View>

      {/* Manual check-in */}
      <TouchableOpacity style={styles.logBtn} onPress={logToday} accessibilityRole="button">
        <Icon name="plus-circle-outline" size={18} color={colors.primaryTeal} />
        <Text style={styles.logBtnText}>Log today's activity</Text>
      </TouchableOpacity>

      {/* Watch sync card — always visible */}
      <View style={styles.watchCard}>
        <View style={styles.watchCardHeader}>
          <Icon name="watch-variant" size={20} color={colors.pulaCardBg} />
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
          >
            {syncing
              ? <ActivityIndicator size="small" color={colors.white} />
              : <Icon name="sync" size={16} color={colors.white} />
            }
            <Text style={styles.syncBtnText}>
              {syncing ? 'Syncing…' : 'Sync now'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Android: Health Connect not installed */}
        {hcAvailable === false && isAndroid && (
          <View style={styles.unavailableBox}>
            <Text style={styles.unavailableText}>
              Health Connect is not installed on this device. Install it from the Play Store, then come back and sync.
            </Text>
            <View style={styles.unavailableActions}>
              <TouchableOpacity style={styles.installBtn} onPress={openHealthConnect}>
                <Icon name="google-play" size={14} color={colors.white} />
                <Text style={styles.installBtnText}>Install Health Connect</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.retryBtn} onPress={retryAvailability}>
                <Text style={styles.retryBtnText}>I've installed it →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* iOS: HealthKit always available but shown just in case */}
        {hcAvailable === false && !isAndroid && (
          <View style={styles.unavailableBox}>
            <Text style={styles.unavailableText}>
              HealthKit is not available on this device. This feature requires iOS 13+ on a physical iPhone.
            </Text>
          </View>
        )}

        {/* Sync result message */}
        {syncResult && (
          <View style={[
            styles.resultBox,
            syncResult.includes('denied') || syncResult.includes('failed')
              ? styles.resultBoxError
              : styles.resultBoxSuccess,
          ]}>
            <Icon
              name={syncResult.includes('denied') || syncResult.includes('failed') ? 'alert-circle-outline' : 'check-circle-outline'}
              size={14}
              color={syncResult.includes('denied') || syncResult.includes('failed') ? '#DC2626' : '#16A34A'}
            />
            <Text style={[
              styles.resultText,
              syncResult.includes('denied') || syncResult.includes('failed')
                ? styles.resultTextError
                : styles.resultTextSuccess,
            ]}>
              {syncResult}
            </Text>
          </View>
        )}

        {/* Supported devices list */}
        <View style={styles.supportedRow}>
          <Icon name="information-outline" size={12} color={colors.textTertiary} />
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
  screen: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing.lg + 2, paddingBottom: spacing.xl * 2, gap: spacing.lg },

  title: { ...typography.h1, color: colors.textPrimary },
  subtitle: { ...typography.bodySmall, color: colors.textSecondary },

  weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayColumn: { alignItems: 'center', gap: spacing.xs + 2 },
  dot: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.surfaceNeutral,
    alignItems: 'center', justifyContent: 'center',
  },
  dotOn: { backgroundColor: colors.primaryTeal },
  dotToday: { borderWidth: 2, borderColor: colors.primaryTeal },
  dayLabel: { ...typography.caption, color: colors.textTertiary },
  dayLabelToday: { color: colors.primaryTeal, fontWeight: '600' },

  logBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.lightTealSurface,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
  },
  logBtnText: { ...typography.body, fontWeight: '500', color: colors.primaryTeal },

  watchCard: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: spacing.lg,
    gap: spacing.md,
  },
  watchCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  watchCardTitle: { ...typography.h3, color: colors.pulaCardBg },
  watchCardBody: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },

  checkingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  checkingText: { ...typography.caption, color: colors.textTertiary },

  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, backgroundColor: colors.primaryTeal,
    borderRadius: radius.md, paddingVertical: spacing.md,
  },
  syncBtnDisabled: { opacity: 0.5 },
  syncBtnText: { ...typography.bodySmall, fontWeight: '500', color: colors.white },

  unavailableBox: { gap: spacing.sm },
  unavailableText: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },
  unavailableActions: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  installBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2,
    backgroundColor: colors.pulaCardBg, borderRadius: radius.md,
    paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md,
  },
  installBtnText: { ...typography.caption, fontWeight: '500', color: colors.white },
  retryBtn: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.sm },
  retryBtnText: { ...typography.caption, color: colors.primaryTeal },

  resultBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs + 2,
    borderRadius: radius.md, padding: spacing.sm + 2,
  },
  resultBoxSuccess: { backgroundColor: '#F0FDF4' },
  resultBoxError: { backgroundColor: '#FEF2F2' },
  resultText: { ...typography.caption, flex: 1 },
  resultTextSuccess: { color: '#16A34A' },
  resultTextError: { color: '#DC2626' },

  supportedRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2,
    paddingTop: spacing.xs,
  },
  supportedText: { ...typography.caption, color: colors.textTertiary },
});
