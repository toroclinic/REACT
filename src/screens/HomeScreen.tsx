import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuthStore } from '../store/authStore';
import { useEngagementStore } from '../store/engagementStore';
import { PulaCard } from '../components/PulaCard';
import { TierProgressBar } from '../components/TierProgressBar';
import { TaskRow } from '../components/TaskRow';
import { computeTasks } from '../services/pricingMirror';
import { formatLastSynced, getCachedMemberProfile } from '../services/cache';
import { colors, spacing, typography, radius } from '../theme/tokens';
import { RootTabParamList } from '../navigation/types';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';

interface Props {
  navigation: BottomTabNavigationProp<RootTabParamList, 'Home'>;
}

function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Dumelang';   // Good morning in Setswana
  if (h < 17) return 'Dumela';     // Good afternoon
  return 'Robala sentle';           // Good evening
}

export function HomeScreen({ navigation }: Props) {
  const memberId = useAuthStore((s) => s.memberId);
  const { profile, isOffline, isLoading, loadFromCache, refreshFromServer } =
    useEngagementStore();
  const [memberName, setMemberName] = useState<string | null>(null);

  useEffect(() => {
    void loadFromCache();
    getCachedMemberProfile().then((p) => {
      if (p?.full_name) setMemberName(firstName(p.full_name));
    });
  }, [loadFromCache]);

  useFocusEffect(
    useCallback(() => {
      if (memberId) void refreshFromServer(memberId);
    }, [memberId, refreshFromServer]),
  );

  // Skeleton while cache hasn't loaded yet
  if (!profile) {
    return (
      <View style={styles.skeleton}>
        <View style={[styles.skeletonBlock, { width: 120, height: 16, marginBottom: 6 }]} />
        <View style={[styles.skeletonBlock, { width: 200, height: 28, marginBottom: spacing.lg }]} />
        <View style={[styles.skeletonBlock, { height: 120, borderRadius: radius.xl, marginBottom: spacing.lg }]} />
        <View style={[styles.skeletonBlock, { height: 16, width: 160, marginBottom: spacing.md }]} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={[styles.skeletonBlock, { height: 52, borderRadius: radius.md, marginBottom: spacing.sm }]} />
        ))}
      </View>
    );
  }

  const tasks = computeTasks(profile);
  const isNewMember = profile.score === 0 && profile.tier === 'Starting';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() => memberId && refreshFromServer(memberId)}
          tintColor={colors.primaryTeal}
        />
      }
    >
      <Text style={styles.greeting}>
        {greeting()}{memberName ? `, ${memberName}` : ''}
      </Text>
      <Text style={styles.title}>Wellness+</Text>

      <PulaCard creditPct={profile.credit_pct} tier={profile.tier} score={profile.score} />

      {isOffline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineNote}>
            📶 Offline · {formatLastSynced(profile.last_synced_at)}
          </Text>
        </View>
      )}

      <View style={styles.progressWrap}>
        <TierProgressBar score={profile.score} />
      </View>

      {isNewMember ? (
        <>
          <Text style={styles.sectionLabel}>Welcome to Wellness+</Text>
          <View style={styles.onboardingCard}>
            <Text style={styles.onboardingTitle}>Start earning today</Text>
            <Text style={styles.onboardingBody}>
              Complete health screenings and daily activity check-ins to earn Pula credits and move up your tier.
            </Text>
            <View style={styles.onboardingSteps}>
              {[
                { icon: '🩺', text: 'Log a BP or glucose reading (25 pts each)' },
                { icon: '🏃', text: 'Check in 4× this cycle for activity (20 pts)' },
                { icon: '💊', text: 'Confirm your medication daily (10 pts)' },
              ].map(({ icon, text }) => (
                <View key={text} style={styles.onboardingStep}>
                  <Text style={styles.onboardingIcon}>{icon}</Text>
                  <Text style={styles.onboardingStepText}>{text}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : (
        <Text style={styles.sectionLabel}>Keep going this cycle</Text>
      )}

      <View style={styles.taskList}>
        {tasks.length === 0 ? (
          <View style={styles.allDoneCard}>
            <Text style={styles.allDoneIcon}>🎉</Text>
            <Text style={styles.allDoneTitle}>All tasks complete!</Text>
            <Text style={styles.allDoneBody}>
              You've done everything for this cycle. Your credits will be applied at renewal.
            </Text>
          </View>
        ) : (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onPress={() => navigation.navigate(task.target)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing.lg + 2, paddingBottom: spacing.xl * 2, gap: spacing.lg - 2 },

  skeleton: { flex: 1, backgroundColor: colors.white, padding: spacing.lg + 2 },
  skeletonBlock: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.md,
    width: '100%',
  },

  greeting: { ...typography.bodySmall, color: colors.textSecondary },
  title: { ...typography.h1, color: colors.textPrimary, marginBottom: spacing.xs },

  offlineBanner: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  offlineNote: { ...typography.caption, color: colors.textTertiary },

  progressWrap: { marginTop: spacing.xs },

  sectionLabel: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  taskList: { gap: spacing.sm },

  onboardingCard: {
    backgroundColor: colors.lightTealSurface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  onboardingTitle: { ...typography.h3, color: colors.pulaCardBg, marginBottom: spacing.xs },
  onboardingBody: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.md },
  onboardingSteps: { gap: spacing.sm },
  onboardingStep: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  onboardingIcon: { fontSize: 16, lineHeight: 20 },
  onboardingStepText: { ...typography.bodySmall, color: colors.textPrimary, flex: 1 },

  allDoneCard: {
    backgroundColor: colors.lightTealSurface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  allDoneIcon: { fontSize: 32 },
  allDoneTitle: { ...typography.h3, color: colors.pulaCardBg },
  allDoneBody: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
});
