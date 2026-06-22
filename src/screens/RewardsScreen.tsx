import React, { useEffect, useState } from 'react';
import {
  ScrollView, View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Clipboard, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { RewardsApi } from '../services/api';
import { cacheRewardsCatalog, getCachedRewardsCatalog } from '../services/cache';
import { useEngagementStore } from '../store/engagementStore';
import { useAuthStore } from '../store/authStore';
import { RewardOffer, Tier } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

const TIER_ORDER: Record<Tier, number> = { Starting: 0, Bronze: 1, Silver: 2, Gold: 3 };
const TIER_LABELS: Record<Tier, string> = {
  Starting: 'Starting tier',
  Bronze: 'Bronze+',
  Silver: 'Silver+',
  Gold: 'Gold only',
};

function TierBadge({ tier, unlocked }: { tier: Tier; unlocked: boolean }) {
  const bg = unlocked ? colors.lightTealSurface : colors.surfaceNeutral;
  const fg = unlocked ? colors.primaryTeal : colors.textTertiary;
  return (
    <View style={[styles.tierPill, { backgroundColor: bg }]}>
      <Text style={[styles.tierPillText, { color: fg }]}>{TIER_LABELS[tier]}</Text>
    </View>
  );
}

export function RewardsScreen() {
  const profile = useEngagementStore((s) => s.profile);
  const memberId = useAuthStore((s) => s.memberId);
  const [catalog, setCatalog] = useState<RewardOffer[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const cached = await getCachedRewardsCatalog();
      if (cached) setCatalog(cached);
      try {
        const fresh = await RewardsApi.getCatalog();
        setCatalog(fresh);
        await cacheRewardsCatalog(fresh);
      } catch { /* offline — cached above */ }
    })();
  }, []);

  const memberTierRank = profile ? TIER_ORDER[profile.tier] : 0;

  const handleRedeem = async (offer: RewardOffer) => {
    if (!memberId) return;
    if (codes[offer.id]) {
      // Already redeemed — just show again
      setExpanded(offer.id);
      return;
    }
    Alert.alert(
      `Redeem ${offer.offer}`,
      `This will generate a redemption code for ${offer.partner}. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            setRedeeming(offer.id);
            try {
              const result = await RewardsApi.redeem(offer.id, memberId);
              const code = result.redemption_code ?? result.instore_confirmation_id ?? '—';
              setCodes((prev) => ({ ...prev, [offer.id]: code }));
            } catch {
              Alert.alert('Could not redeem', 'Please check your connection or tier eligibility and try again.');
            } finally {
              setRedeeming(null);
            }
          },
        },
      ],
    );
  };

  const copyCode = (offerId: string, code: string) => {
    Clipboard.setString(code);
    setCopied(offerId);
    setTimeout(() => setCopied(null), 2000);
  };

  const unlocked = catalog.filter((o) => memberTierRank >= TIER_ORDER[o.min_tier]);
  const locked = catalog.filter((o) => memberTierRank < TIER_ORDER[o.min_tier]);

  const renderOffer = (offer: RewardOffer, isUnlocked: boolean) => {
    const isExpanded = expanded === offer.id;
    const code = codes[offer.id];
    const isRedeeming = redeeming === offer.id;

    return (
      <TouchableOpacity
        key={offer.id}
        style={[styles.card, !isUnlocked && styles.cardLocked]}
        onPress={() => isUnlocked && setExpanded(isExpanded ? null : offer.id)}
        activeOpacity={isUnlocked ? 0.7 : 1}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
      >
        <View style={styles.cardHeader}>
          <View style={styles.iconWrap}>
            <Icon name={offer.icon || 'gift-outline'} size={20} color={isUnlocked ? colors.primaryTeal : colors.textTertiary} />
          </View>
          <View style={styles.cardMeta}>
            <Text style={[styles.offerName, !isUnlocked && styles.textMuted]}>{offer.offer}</Text>
            <Text style={styles.offerPartner}>{offer.partner}</Text>
          </View>
          <View style={styles.cardRight}>
            {offer.value && (
              <Text style={[styles.offerValue, !isUnlocked && styles.textMuted]}>{offer.value}</Text>
            )}
            <TierBadge tier={offer.min_tier} unlocked={isUnlocked} />
          </View>
          {isUnlocked && (
            <Icon
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textTertiary}
            />
          )}
        </View>

        {isExpanded && isUnlocked && (
          <View style={styles.cardBody}>
            {offer.description && (
              <Text style={styles.description}>{offer.description}</Text>
            )}

            {code ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeLabel}>Your redemption code</Text>
                <Text style={styles.code}>{code}</Text>
                <TouchableOpacity
                  style={styles.copyBtn}
                  onPress={() => copyCode(offer.id, code)}
                >
                  <Icon name={copied === offer.id ? 'check' : 'content-copy'} size={14} color={colors.primaryTeal} />
                  <Text style={styles.copyBtnText}>
                    {copied === offer.id ? 'Copied!' : 'Copy code'}
                  </Text>
                </TouchableOpacity>
                {offer.expiry_days && (
                  <Text style={styles.expiryNote}>
                    Valid for {offer.expiry_days} days after redemption. Show at {offer.partner} to claim.
                  </Text>
                )}
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.redeemBtn, isRedeeming && styles.redeemBtnDisabled]}
                onPress={() => handleRedeem(offer)}
                disabled={isRedeeming}
              >
                {isRedeeming
                  ? <ActivityIndicator size="small" color={colors.white} />
                  : <>
                      <Icon name="gift-outline" size={16} color={colors.white} />
                      <Text style={styles.redeemBtnText}>Redeem this reward</Text>
                    </>
                }
              </TouchableOpacity>
            )}
          </View>
        )}

        {!isUnlocked && (
          <View style={styles.lockedBanner}>
            <Icon name="lock-outline" size={13} color={colors.textTertiary} />
            <Text style={styles.lockedText}>
              Reach {TIER_LABELS[offer.min_tier]} to unlock this reward
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Rewards</Text>
      {profile && (
        <View style={styles.tierSummary}>
          <Text style={styles.tierSummaryText}>
            You're on{' '}
            <Text style={styles.tierSummaryTier}>{profile.tier}</Text>
            {' '}· {unlocked.length} reward{unlocked.length !== 1 ? 's' : ''} available
          </Text>
        </View>
      )}

      {unlocked.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Available to you</Text>
          {unlocked.map((o) => renderOffer(o, true))}
        </>
      )}

      {locked.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Unlock with higher tier</Text>
          {locked.map((o) => renderOffer(o, false))}
        </>
      )}

      {catalog.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎁</Text>
          <Text style={styles.emptyText}>No rewards available yet. Check back soon.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.white },
  content: { padding: spacing.lg + 2, gap: spacing.sm + 2, paddingBottom: spacing.xl * 2 },
  title: { ...typography.h1, color: colors.textPrimary },

  tierSummary: {
    backgroundColor: colors.lightTealSurface,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tierSummaryText: { ...typography.bodySmall, color: colors.textSecondary },
  tierSummaryTier: { fontWeight: '600', color: colors.primaryTeal },

  sectionLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },

  card: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  cardLocked: { opacity: 0.65 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36, height: 36,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  cardMeta: { flex: 1, gap: 2 },
  offerName: { ...typography.bodySmall, fontWeight: '500', color: colors.textPrimary },
  offerPartner: { ...typography.caption, color: colors.textTertiary },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  offerValue: { ...typography.bodySmall, fontWeight: '600', color: colors.primaryTeal },
  textMuted: { color: colors.textTertiary },

  tierPill: { borderRadius: 20, paddingVertical: 2, paddingHorizontal: spacing.sm },
  tierPillText: { ...typography.caption, fontWeight: '500' },

  cardBody: {
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  description: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },

  codeBox: {
    backgroundColor: colors.white,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeLabel: { ...typography.caption, color: colors.textTertiary },
  code: { ...typography.h3, letterSpacing: 2, color: colors.pulaCardBg, fontFamily: 'monospace' },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  copyBtnText: { ...typography.caption, color: colors.primaryTeal, fontWeight: '500' },
  expiryNote: { ...typography.caption, color: colors.textTertiary },

  redeemBtn: {
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  redeemBtnDisabled: { opacity: 0.5 },
  redeemBtnText: { ...typography.bodySmall, fontWeight: '500', color: colors.white },

  lockedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2,
    paddingHorizontal: spacing.md, paddingBottom: spacing.sm,
  },
  lockedText: { ...typography.caption, color: colors.textTertiary },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40 },
  emptyText: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
});
