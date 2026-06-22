import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuthStore } from '../store/authStore';
import { useEngagementStore } from '../store/engagementStore';
import { ProfileApi } from '../services/api';
import { cacheMemberProfile, getCachedMemberProfile } from '../services/cache';
import { MemberProfile } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

const TIER_COLORS: Record<string, { bg: string; text: string }> = {
  Starting: colors.tierStarting,
  Bronze:   colors.tierBronze,
  Silver:   colors.tierSilver,
  Gold:     colors.tierGold,
};

export function ProfileScreen() {
  const memberId = useAuthStore((s) => s.memberId);
  const signOut = useAuthStore((s) => s.signOut);
  const engagementProfile = useEngagementStore((s) => s.profile);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    (async () => {
      const cached = await getCachedMemberProfile();
      if (cached) setProfile(cached);
      if (!memberId) return;
      setSyncing(true);
      try {
        const fresh = await ProfileApi.getProfile(memberId);
        setProfile(fresh);
        await cacheMemberProfile(fresh);
      } catch {
        // Stay on cached data while offline
      } finally {
        setSyncing(false);
      }
    })();
  }, [memberId]);

  const handleSignOut = () => {
    Alert.alert(
      'Sign out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  };

  if (!profile) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primaryTeal} />
      </View>
    );
  }

  const tier = engagementProfile?.tier ?? 'Starting';
  const score = engagementProfile?.score ?? 0;
  const creditPct = engagementProfile?.credit_pct ?? 0;
  const tierColors = TIER_COLORS[tier] ?? colors.tierStarting;

  const detailRows: [string, string][] = [
    ['Phone', profile.phone_number],
    ['Policy', profile.policy_number],
    ['Language', profile.preferred_language === 'tn' ? 'Setswana' : 'English'],
    ['Renewal', new Date(profile.renewal_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })],
    ['Partner clinic', profile.preferred_clinic_id ?? 'Not yet assigned'],
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(profile.full_name)}</Text>
          </View>
          {syncing && (
            <ActivityIndicator size="small" color={colors.primaryTeal} style={styles.syncIndicator} />
          )}
        </View>
        <Text style={styles.name}>{profile.full_name}</Text>
        <Text style={styles.memberId}>Member · {profile.member_id}</Text>
      </View>

      {/* Tier badge */}
      <View style={[styles.tierBadge, { backgroundColor: tierColors.bg }]}>
        <View style={styles.tierLeft}>
          <Text style={[styles.tierLabel, { color: tierColors.text }]}>{tier}</Text>
          <Text style={[styles.tierScore, { color: tierColors.text }]}>{score.toFixed(0)} / 100 pts</Text>
        </View>
        <View style={styles.tierRight}>
          <Text style={[styles.creditPct, { color: tierColors.text }]}>{creditPct}%</Text>
          <Text style={[styles.creditLabel, { color: tierColors.text }]}>premium credit</Text>
        </View>
      </View>

      {/* Detail rows */}
      <View style={styles.card}>
        {detailRows.map(([label, value], i) => (
          <View key={label} style={[styles.row, i < detailRows.length - 1 && styles.rowDivider]}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
          </View>
        ))}
      </View>

      {/* Member type pill */}
      {profile.chronic_member && (
        <View style={styles.chronicPill}>
          <Icon name="shield-heart" size={14} color={colors.primaryTeal} />
          <Text style={styles.chronicText}>Chronic member — enhanced scoring applies</Text>
        </View>
      )}

      {/* Sign out */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={handleSignOut}
        accessibilityRole="button"
      >
        <Icon name="logout" size={16} color={colors.coral} />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>Wellness+ · Policy ID {profile.policy_number}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing.lg + 2, paddingBottom: spacing.xl * 2, gap: spacing.lg },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { alignItems: 'center', paddingTop: spacing.md },
  avatarWrap: { position: 'relative', marginBottom: spacing.sm },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.lightTealSurface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.primaryTeal,
  },
  avatarText: { fontSize: 26, fontWeight: '500', color: colors.pulaCardBg },
  syncIndicator: { position: 'absolute', bottom: -4, right: -4 },
  name: { ...typography.h2, color: colors.textPrimary },
  memberId: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },

  tierBadge: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderRadius: radius.lg, padding: spacing.lg,
  },
  tierLeft: { gap: 2 },
  tierLabel: { ...typography.h3 },
  tierScore: { ...typography.caption },
  tierRight: { alignItems: 'flex-end', gap: 2 },
  creditPct: { fontSize: 28, fontWeight: '500' },
  creditLabel: { ...typography.caption },

  card: { borderWidth: 0.5, borderColor: colors.border, borderRadius: radius.lg },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg - 2,
  },
  rowDivider: { borderBottomWidth: 0.5, borderBottomColor: colors.border },
  rowLabel: { ...typography.bodySmall, color: colors.textSecondary },
  rowValue: { ...typography.bodySmall, color: colors.textPrimary, maxWidth: '60%', textAlign: 'right' },

  chronicPill: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2,
    backgroundColor: colors.lightTealSurface,
    borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
  },
  chronicText: { ...typography.caption, color: colors.primaryTeal },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, borderWidth: 1, borderColor: '#FECACA',
    borderRadius: radius.md, paddingVertical: spacing.md,
    backgroundColor: '#FEF2F2',
  },
  signOutText: { ...typography.bodySmall, color: colors.coral, fontWeight: '500' },

  footer: { ...typography.caption, color: colors.textTertiary, textAlign: 'center' },
});
