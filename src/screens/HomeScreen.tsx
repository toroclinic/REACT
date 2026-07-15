import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Linking,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../store/authStore';
import { useEngagementStore } from '../store/engagementStore';
import { TierProgressBar } from '../components/TierProgressBar';
import { TaskRow } from '../components/TaskRow';
import { DailyTasksCard } from '../components/DailyTasksCard';
import { ChronicCareCard } from '../components/ChronicCareCard';
import { CareProtocolCard } from '../components/CareProtocolCard';
import { AppointmentCard } from '../components/AppointmentCard';
import { RemindersCard } from '../components/RemindersCard';
import { computeTasks } from '../services/pricingMirror';
import { getCachedMemberProfile } from '../services/cache';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { MessagesApi, MemberApi } from '../services/api';
import { Appointment, HealthAlert } from '../types/api';
import { colors, spacing, typography, radius, fonts } from '../theme/tokens';
import { RootTabParamList } from '../navigation/types';

interface Props {
  navigation: BottomTabNavigationProp<RootTabParamList, 'Home'>;
}

function firstName(fullName: string): string {
  return fullName.split(' ')[0] ?? fullName;
}

// Computed once per day at module load — toLocaleDateString + locale lookup
// is expensive; re-running it on every render is wasteful for a value that
// changes once every 24 hours.
const TODAY_LABEL = new Date().toLocaleDateString('en-BW', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function HomeScreen({ navigation }: Props) {
  const memberId = useAuthStore(s => s.memberId);
  const { profile, isOffline, isLoading, loadFromCache, refreshFromServer } =
    useEngagementStore();
  const [memberName, setMemberName] = useState<string | null>(null);
  const [annualPremium, setAnnualPremium] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(
    new Set(),
  );
  const lastFetchAt = useRef(0);
  const skeletonAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (profile) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonAnim, {
          toValue: 0.5,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [profile, skeletonAnim]);

  useEffect(() => {
    void loadFromCache();
    getCachedMemberProfile()
      .then(cached => {
        if (cached?.full_name) {
          setMemberName(firstName(cached.full_name));
        }
        if (cached?.annual_premium_bwp) {
          setAnnualPremium(cached.annual_premium_bwp);
        }
      })
      .catch(() => {});
  }, [loadFromCache]);

  useFocusEffect(
    useCallback(() => {
      if (!memberId) {
        return;
      }
      const now = Date.now();
      // Throttle to one full refresh per 90 seconds — prevents 4× network
      // calls on every tab switch while still catching data updated elsewhere.
      if (now - lastFetchAt.current < 90_000) {
        return;
      }
      lastFetchAt.current = now;
      void refreshFromServer(memberId);
      MessagesApi.getUnreadCount(memberId)
        .then(({ count }) => setUnreadCount(count))
        .catch(() => setUnreadCount(0));
      MemberApi.getAppointments(memberId)
        .then(setAppointments)
        .catch(() => setAppointments([]));
      MemberApi.getAlerts(memberId)
        .then(setAlerts)
        .catch(() => setAlerts([]));
    }, [memberId, refreshFromServer]),
  );

  // Hooks must be before any early return — cannot call conditionally.
  const tasks = useMemo(
    () => (profile ? computeTasks(profile) : []),
    [profile],
  );
  const visibleAlerts = useMemo(
    () => alerts.filter(a => !dismissedAlerts.has(a.alert_id)),
    [alerts, dismissedAlerts],
  );
  const walletSaving = useMemo(() => {
    if (!profile || annualPremium == null || profile.credit_pct <= 0) {
      return null;
    }
    return `P ${((annualPremium * profile.credit_pct) / 100).toLocaleString(
      'en-BW',
      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
    )}`;
  }, [annualPremium, profile]);

  if (!profile) {
    return (
      <View style={styles.skeleton}>
        <Animated.View
          style={[
            styles.skeletonBlock,
            styles.skeletonHero,
            { opacity: skeletonAnim },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonBlock,
            styles.skeletonTitle,
            { opacity: skeletonAnim },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonBlock,
            styles.skeletonCard,
            { opacity: skeletonAnim },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonBlock,
            styles.skeletonRowFirst,
            { opacity: skeletonAnim },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonBlock,
            styles.skeletonRow,
            { opacity: skeletonAnim },
          ]}
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={() => {
            if (memberId) {
              void refreshFromServer(memberId);
            }
          }}
          tintColor={colors.heroTeal}
        />
      }
    >
      {/* ── Hero band ── */}
      <View style={[styles.heroBand, { paddingTop: spacing.md }]}>
        <View style={styles.heroStatus}>
          <Text style={styles.heroDate}>{TODAY_LABEL}</Text>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            accessibilityLabel={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : 'Notifications'
            }
          >
            <Text style={styles.bellIcon}>🔔</Text>
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 9 ? '9+' : String(unreadCount)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.heroGreeting}>
          {memberName ? `Dumela, ${memberName}` : 'Toro Wellness+'}
        </Text>
        <Text style={styles.heroLabel}>YOUR PULA WALLET</Text>
        {walletSaving != null ? (
          <Text style={styles.heroBalance}>{walletSaving}</Text>
        ) : (
          <Text style={[styles.heroBalance, styles.heroBalanceDim]}>
            {profile.credit_pct}% credit
          </Text>
        )}
        <View style={styles.heroTierRow}>
          <View style={styles.heroTierBadge}>
            <Text style={styles.heroTierBadgeText}>{profile.tier}</Text>
          </View>
          <Text style={styles.heroTierText}>
            {profile.credit_pct}% off at renewal
          </Text>
          {isOffline && (
            <View style={styles.offlinePill}>
              <Text style={styles.offlinePillText}>offline</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.body}>
        {/* ── Health alerts ── */}
        {visibleAlerts.map(alert => {
          const isCritical = alert.severity === 'critical';
          const isAbnormal = alert.severity === 'abnormal';
          const bg = isCritical
            ? colors.dangerBg
            : isAbnormal
            ? colors.warningBg
            : colors.successBg;
          const border = isCritical
            ? colors.dangerText
            : isAbnormal
            ? colors.warningText
            : colors.successText;
          const color = isCritical
            ? colors.dangerText
            : isAbnormal
            ? colors.warningText
            : colors.successText;
          return (
            <View
              key={alert.alert_id}
              style={[
                styles.alertBanner,
                { backgroundColor: bg, borderColor: border },
              ]}
            >
              <View style={styles.alertHeader}>
                <Text style={[styles.alertTitle, { color }]}>
                  {isCritical
                    ? '🆘 Critical · '
                    : isAbnormal
                    ? '⚠️ Abnormal · '
                    : '✅ '}
                  {alert.parameter.replace(/_/g, ' ')}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    setDismissedAlerts(prev => {
                      const s = new Set(prev);
                      s.add(alert.alert_id);
                      return s;
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="Dismiss alert"
                  hitSlop={{ top: 8, bottom: 8, left: 12, right: 8 }}
                >
                  <Text style={[styles.alertDismiss, { color }]}>✕</Text>
                </TouchableOpacity>
              </View>
              {alert.value_text && (
                <Text style={[styles.alertValue, { color }]}>
                  {alert.value_text}
                </Text>
              )}
              {alert.detail && (
                <Text style={[styles.alertDetail, { color }]}>
                  {alert.detail}
                </Text>
              )}
              {isCritical && (
                <TouchableOpacity
                  style={styles.alertCallBtn}
                  onPress={() => Linking.openURL('tel:997')}
                >
                  <Text style={styles.alertCallText}>Call 997 — Emergency</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {/* ── Tier progress ── */}
        <TierProgressBar score={profile.score} />

        {/* ── Quick access ── */}
        <View style={styles.quickRow}>
          {(
            [
              {
                screen: 'Messages',
                icon: 'message-text-outline',
                label: 'Inbox',
                accent: colors.primaryTeal,
                bg: colors.primaryTealLight,
                badge: unreadCount,
              },
              {
                // Pine accent — gold is reserved for rewards semantics, and
                // the coach is not a reward.
                screen: 'Coach',
                icon: 'robot-outline',
                label: 'Tora AI',
                accent: colors.pine,
                bg: colors.mintWash,
                badge: 0,
              },
              {
                // Gold IS correct here: Rewards is the gold-semantics surface.
                screen: 'Rewards',
                icon: 'gift-outline',
                label: 'Rewards',
                accent: colors.goldText,
                bg: colors.goldLight,
                badge: 0,
              },
            ] as const
          ).map(({ screen, icon, label, accent, bg, badge }) => (
            <TouchableOpacity
              key={screen}
              style={styles.quickCard}
              onPress={() => navigation.navigate(screen)}
              accessibilityRole="button"
              accessibilityLabel={
                badge > 0 ? `${label}, ${badge} unread` : label
              }
            >
              <View style={[styles.quickIconWrap, { backgroundColor: bg }]}>
                <Icon name={icon} size={22} color={accent} />
                {badge > 0 && (
                  <View style={styles.quickBadge}>
                    <Text style={styles.quickBadgeText}>
                      {badge > 9 ? '9+' : String(badge)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.quickLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Score breakdown ── */}
        {profile.breakdown && profile.breakdown.length > 0 && (
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownHeader}>
              <Text style={styles.breakdownTitle}>Score breakdown</Text>
              {profile.scheme_name && (
                <View
                  style={[
                    styles.schemePill,
                    {
                      backgroundColor: profile.scheme_color ?? colors.heroTeal,
                    },
                  ]}
                >
                  <Text style={styles.schemePillText}>
                    {profile.scheme_name}
                  </Text>
                </View>
              )}
            </View>
            {profile.breakdown.map(item => (
              <View key={item.category} style={styles.breakdownRow}>
                <View
                  style={[
                    styles.breakdownDot,
                    {
                      backgroundColor: item.done ? colors.gold : colors.border,
                    },
                  ]}
                />
                <Text style={styles.breakdownLabel}>{item.category}</Text>
                <Text
                  style={[
                    styles.breakdownPts,
                    item.done && styles.breakdownPtsDone,
                  ]}
                >
                  {item.earned} / {item.max} pts
                </Text>
              </View>
            ))}
            {profile.next_tier && (
              <Text style={styles.nextTierNote}>
                {(profile.points_to_next_tier ?? 0) > 0
                  ? `${profile.points_to_next_tier} pts to ${profile.next_tier}`
                  : `${profile.next_tier} reached!`}
              </Text>
            )}
          </View>
        )}

        {/* ── Daily tasks ── */}
        {memberId && (
          <DailyTasksCard
            profileTasks={{
              blood_pressure: profile.bp_screening_status !== 'not_logged',
              activity: profile.activity_checkins_this_cycle > 0,
              medication: profile.medication_confirmed_this_month,
            }}
            onNavigate={screen => {
              if (screen === 'Activity') {
                navigation.navigate('Activity');
              } else if (screen === 'Screening') {
                navigation.navigate('Screening');
              }
            }}
          />
        )}

        {/* ── Chronic care ── */}
        {memberId && profile.chronic_member && (
          <ChronicCareCard memberId={memberId} />
        )}

        {/* ── Scheduled lab tests + completion codes (null unless enrolled) ── */}
        {memberId && <CareProtocolCard memberId={memberId} />}

        {/* ── Reminders ── */}
        {memberId && <RemindersCard memberId={memberId} />}

        {/* ── Appointments ── */}
        {appointments.length > 0 && (
          <View>
            {appointments.slice(0, 2).map(appt => (
              <AppointmentCard key={appt.appointment_id} appointment={appt} />
            ))}
          </View>
        )}
        <TouchableOpacity
          style={styles.bookCta}
          onPress={() => navigation.navigate('Screening')}
          accessibilityRole="button"
          accessibilityLabel="Find a clinic and book appointment"
        >
          <Text style={styles.bookCtaText}>🏥 Find a clinic &amp; book</Text>
        </TouchableOpacity>

        {/* ── Cycle tasks ── */}
        <Text style={styles.sectionLabel}>Keep going this cycle</Text>
        <View style={styles.taskList}>
          {tasks.length === 0 ? (
            <View style={styles.allDoneCard}>
              <Text style={styles.allDoneIcon}>🎉</Text>
              <Text style={styles.allDoneTitle}>All tasks complete!</Text>
              <Text style={styles.allDoneBody}>
                Your credits will apply at renewal.
              </Text>
            </View>
          ) : (
            tasks.map(task => (
              <TaskRow
                key={task.id}
                task={task}
                onPress={() => {
                  if (task.target === 'Activity') {
                    navigation.navigate('Activity');
                  } else if (task.target === 'Screening') {
                    navigation.navigate('Screening');
                  } else if (task.target === 'Rewards') {
                    navigation.navigate('Rewards');
                  }
                }}
              />
            ))
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  content: { paddingBottom: spacing.xl * 3 },

  skeleton: { flex: 1, backgroundColor: colors.screenBg, padding: spacing.lg },
  skeletonBlock: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    width: '100%',
    marginBottom: 0,
  },
  skeletonHero: { height: 140 },
  skeletonTitle: { height: 20, width: 160, marginTop: spacing.lg },
  skeletonCard: { height: 100, marginTop: spacing.md },
  skeletonRowFirst: { height: 56, marginTop: spacing.md },
  skeletonRow: { height: 56, marginTop: spacing.sm },

  // Hero band — board HeroHeaderCard treatment: teal bg, rounded-BOTTOM
  // corners (radius.hero) so it reads as page chrome. Matches PWA.
  heroBand: {
    backgroundColor: colors.primaryTeal,
    paddingHorizontal: 18,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
  },
  heroStatus: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  heroDate: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.1,
  },
  // Bell is now a 36×36 circle container — matches PWA .home-hero-bell
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellIcon: { fontSize: 18 },
  // Badge uses gold (#C8873A) — matches PWA .home-hero-badge; was orange F97316
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 9, fontWeight: '700' as const },
  heroGreeting: {
    fontSize: 16,
    fontFamily: fonts.display500,
    color: 'rgba(255,255,255,0.92)',
    marginBottom: 10,
  },
  // Mono eyebrow — board section-label pattern (IBM Plex Mono, tracked caps)
  heroLabel: {
    fontSize: 10,
    fontFamily: fonts.mono500,
    letterSpacing: 2.4,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 5,
    textTransform: 'uppercase',
  },
  // Big figure — Space Grotesk Bold (board display type)
  heroBalance: {
    fontSize: 36,
    fontFamily: fonts.display700,
    color: colors.white,
    marginBottom: spacing.sm,
    letterSpacing: -0.5,
  },
  heroBalanceDim: { fontSize: 28, opacity: 0.85 },
  heroTierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  // Tier badge uses pill radius (99) — matches PWA .home-hero-tier-badge; was radius.md (8)
  heroTierBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  heroTierBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: colors.white,
    letterSpacing: 0.4,
  },
  heroTierText: { fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  offlinePill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  offlinePillText: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },

  body: { padding: 18, gap: spacing.md },

  alertBanner: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    gap: spacing.xs,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTitle: { ...typography.bodySmall, fontWeight: '600' as const, flex: 1 },
  alertDismiss: { fontSize: 16, padding: 2 },
  alertValue: { ...typography.bodySmall },
  alertDetail: { ...typography.caption },
  alertCallBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.emergencyRed, // true emergency context — sanctioned use
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  alertCallText: {
    ...typography.bodySmall,
    color: colors.white,
    fontWeight: '700' as const,
  },

  // Breakdown card — hairline white card (board: no shadows)
  breakdownCard: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.toroBorder,
    padding: spacing.md,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  breakdownTitle: { ...typography.h3, color: colors.textPrimary },
  schemePill: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  schemePillText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600' as const,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  breakdownPts: { ...typography.caption, color: colors.textTertiary },
  breakdownPtsDone: { color: colors.gold, fontWeight: '600' as const },
  nextTierNote: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },

  // Book CTA — matches PWA .appt-book-cta: primaryTealLight bg + primaryTeal border
  bookCta: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryTeal,
    backgroundColor: colors.primaryTealLight,
    paddingVertical: spacing.md,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  bookCtaText: {
    ...typography.bodySmall,
    color: colors.primaryTeal,
    fontWeight: '600' as const,
  },

  // Quick-access shortcuts row
  quickRow: { flexDirection: 'row', gap: spacing.sm },
  quickCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.toroBorder,
  },
  quickIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.gold,
    borderRadius: radius.pill,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  quickBadgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700' as const,
  },
  quickLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600' as const,
  },

  // Section label — board mono eyebrow (IBM Plex Mono, tracked caps)
  sectionLabel: {
    fontSize: 11,
    fontFamily: fonts.mono500,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  taskList: { gap: spacing.sm },
  allDoneCard: {
    backgroundColor: colors.primaryTealLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.toroBorder,
  },
  allDoneIcon: { fontSize: 32 },
  allDoneTitle: { ...typography.h3, color: colors.textPrimary },
  allDoneBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
