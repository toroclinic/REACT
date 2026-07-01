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
  TouchableOpacity,
  ActivityIndicator,
  Clipboard,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { RewardsApi } from '../services/api';
import {
  cacheRewardsCatalog,
  getCachedRewardsCatalog,
} from '../services/cache';
import { useEngagementStore } from '../store/engagementStore';
import { useAuthStore } from '../store/authStore';
import { MyRedemption, RewardOffer, Tier } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

const TIER_ORDER: Record<Tier, number> = {
  Starting: 0,
  Bronze: 1,
  Silver: 2,
  Gold: 3,
};
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
      <Text style={[styles.tierPillText, { color: fg }]}>
        {TIER_LABELS[tier]}
      </Text>
    </View>
  );
}

// ─── OfferCard (memoized) ─────────────────────────────────────────────────────
// Each card is its own memo'd component so expanding/copying/redeeming one card
// does not re-render the rest of the list.

interface OfferCardProps {
  offer: RewardOffer;
  isUnlocked: boolean;
  isExpanded: boolean;
  isRedeeming: boolean;
  code: string | undefined;
  isCopied: boolean;
  onToggle: (id: string) => void;
  onRedeem: (offer: RewardOffer) => void;
  onCopy: (offerId: string, code: string) => void;
}

const OfferCard = React.memo(function OfferCard({
  offer,
  isUnlocked,
  isExpanded,
  isRedeeming,
  code,
  isCopied,
  onToggle,
  onRedeem,
  onCopy,
}: OfferCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, !isUnlocked && styles.cardLocked]}
      onPress={() => isUnlocked && onToggle(offer.id)}
      activeOpacity={isUnlocked ? 0.7 : 1}
      accessibilityRole="button"
      accessibilityState={{ expanded: isExpanded }}
    >
      <View style={styles.cardHeader}>
        <View style={styles.iconWrap}>
          <Icon
            name={offer.icon || 'gift-outline'}
            size={20}
            color={isUnlocked ? colors.primaryTeal : colors.textTertiary}
          />
        </View>
        <View style={styles.cardMeta}>
          <Text style={[styles.offerName, !isUnlocked && styles.textMuted]}>
            {offer.offer}
          </Text>
          <Text style={styles.offerPartner}>{offer.partner}</Text>
        </View>
        <View style={styles.cardRight}>
          {offer.value && (
            <Text style={[styles.offerValue, !isUnlocked && styles.textMuted]}>
              {offer.value}
            </Text>
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
                onPress={() => onCopy(offer.id, code)}
              >
                <Icon
                  name={isCopied ? 'check' : 'content-copy'}
                  size={14}
                  color={colors.primaryTeal}
                />
                <Text style={styles.copyBtnText}>
                  {isCopied ? 'Copied!' : 'Copy code'}
                </Text>
              </TouchableOpacity>
              {offer.expiry_days && (
                <Text style={styles.expiryNote}>
                  Valid for {offer.expiry_days} days after redemption. Show at{' '}
                  {offer.partner} to claim.
                </Text>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.redeemBtn,
                isRedeeming && styles.redeemBtnDisabled,
              ]}
              onPress={() => onRedeem(offer)}
              disabled={isRedeeming}
            >
              {isRedeeming ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Icon name="gift-outline" size={16} color={colors.white} />
                  <Text style={styles.redeemBtnText}>Redeem this reward</Text>
                </>
              )}
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
});

export function RewardsScreen() {
  const profile = useEngagementStore(s => s.profile);
  const memberId = useAuthStore(s => s.memberId);
  const [tab, setTab] = useState<'catalog' | 'history'>('catalog');
  const [catalog, setCatalog] = useState<RewardOffer[]>([]);
  const [redemptions, setRedemptions] = useState<MyRedemption[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cached = await getCachedRewardsCatalog();
        if (cached) {
          setCatalog(cached);
        }
      } catch {
        /* ignore stale cache failure */
      }
      try {
        const fresh = await RewardsApi.getCatalog();
        setCatalog(fresh);
        await cacheRewardsCatalog(fresh);
      } catch {
        /* offline — show cached above */
      }
    })().catch(() => {});
  }, []);

  useEffect(() => {
    if (tab !== 'history' || !memberId || historyFetchingRef.current) {
      return;
    }
    historyFetchingRef.current = true;
    setLoadingHistory(true);
    RewardsApi.getMyRedemptions(memberId)
      .then(setRedemptions)
      .catch(() => setRedemptions([]))
      .finally(() => {
        setLoadingHistory(false);
        historyFetchingRef.current = false;
      });
  }, [tab, memberId]);

  const memberTierRank = profile ? TIER_ORDER[profile.tier] : 0;
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors codes state so handleRedeem can read it without adding codes to its deps
  // (adding codes would recreate handleRedeem on every redemption, breaking React.memo).
  const codesRef = useRef<Record<string, string>>({});
  const redeemingRef = useRef<string | null>(null);
  const historyFetchingRef = useRef(false);

  useEffect(() => {
    codesRef.current = codes;
  }, [codes]);
  // Clean up any pending "Copied!" timer when the component unmounts
  useEffect(
    () => () => {
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current);
      }
    },
    [],
  );

  // Split catalog into unlocked/locked only when catalog or tier changes —
  // not on every expanded/copied/redeeming toggle.
  const { unlocked, locked } = useMemo(
    () => ({
      unlocked: catalog.filter(o => memberTierRank >= TIER_ORDER[o.min_tier]),
      locked: catalog.filter(o => memberTierRank < TIER_ORDER[o.min_tier]),
    }),
    [catalog, memberTierRank],
  );

  const handleRedeem = useCallback(
    async (offer: RewardOffer) => {
      if (!memberId) {
        return;
      }
      if (codesRef.current[offer.id]) {
        setExpanded(offer.id);
        return;
      }
      if (redeemingRef.current) {
        return;
      } // prevent double-tap opening two alerts
      Alert.alert(
        `Redeem ${offer.offer}`,
        `This will generate a redemption code for ${offer.partner}. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Redeem',
            onPress: async () => {
              redeemingRef.current = offer.id;
              setRedeeming(offer.id);
              try {
                const result = await RewardsApi.redeem(offer.id, memberId);
                const code =
                  result.redemption_code ??
                  result.instore_confirmation_id ??
                  '—';
                setCodes(prev => ({ ...prev, [offer.id]: code }));
              } catch {
                Alert.alert(
                  'Could not redeem',
                  'Please check your connection or tier eligibility and try again.',
                );
              } finally {
                redeemingRef.current = null;
                setRedeeming(null);
              }
            },
          },
        ],
      );
    },
    [memberId],
  ); // no codes dep — reads via codesRef so React.memo stays effective

  const copyCode = useCallback((offerId: string, code: string) => {
    Clipboard.setString(code);
    setCopied(offerId);
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
    }
    copiedTimerRef.current = setTimeout(() => setCopied(null), 2000);
  }, []);

  // Functional-update form — no `expanded` in deps, so this ref is always stable.
  const toggleExpand = useCallback((id: string) => {
    setExpanded(prev => (prev === id ? null : id));
  }, []);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Rewards</Text>

      {/* Tab switcher */}
      <View style={styles.tabBar}>
        {(['catalog', 'history'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
            onPress={() => setTab(t)}
          >
            <Text
              style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}
            >
              {t === 'catalog' ? 'Catalog' : 'My redemptions'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* History tab */}
      {tab === 'history' &&
        (loadingHistory ? (
          <ActivityIndicator
            color={colors.primaryTeal}
            style={{ marginTop: spacing.xl }}
          />
        ) : redemptions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🎁</Text>
            <Text style={styles.emptyText}>
              No redemptions yet. Redeem a reward above!
            </Text>
          </View>
        ) : (
          redemptions.map(r => (
            <View key={r.redemption_id} style={styles.redemptionRow}>
              <View style={styles.redemptionInfo}>
                <Text style={styles.redemptionOffer}>{r.offer}</Text>
                <Text style={styles.redemptionPartner}>{r.partner}</Text>
                <Text style={styles.redemptionDate}>
                  Redeemed{' '}
                  {new Date(r.redeemed_at).toLocaleDateString('en-BW', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {r.expires_at
                    ? ` · Expires ${new Date(r.expires_at).toLocaleDateString(
                        'en-BW',
                        { day: 'numeric', month: 'short' },
                      )}`
                    : ''}
                </Text>
              </View>
              {r.redemption_code && (
                <TouchableOpacity
                  style={styles.codePill}
                  onPress={() => {
                    if (r.redemption_code) {
                      Clipboard.setString(r.redemption_code);
                    }
                    setCopied(r.redemption_id);
                    if (copiedTimerRef.current) {
                      clearTimeout(copiedTimerRef.current);
                    }
                    copiedTimerRef.current = setTimeout(
                      () => setCopied(null),
                      2000,
                    );
                  }}
                >
                  <Text style={styles.codePillText}>
                    {copied === r.redemption_id ? 'Copied!' : r.redemption_code}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))
        ))}

      {tab === 'catalog' && profile && (
        <View style={styles.tierSummary}>
          <Text style={styles.tierSummaryText}>
            You're on <Text style={styles.tierSummaryTier}>{profile.tier}</Text>{' '}
            · {unlocked.length} reward{unlocked.length !== 1 ? 's' : ''}{' '}
            available
          </Text>
        </View>
      )}

      {tab === 'catalog' && unlocked.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Available to you</Text>
          {unlocked.map(o => (
            <OfferCard
              key={o.id}
              offer={o}
              isUnlocked={true}
              isExpanded={expanded === o.id}
              isRedeeming={redeeming === o.id}
              code={codes[o.id]}
              isCopied={copied === o.id}
              onToggle={toggleExpand}
              onRedeem={handleRedeem}
              onCopy={copyCode}
            />
          ))}
        </>
      )}

      {tab === 'catalog' && locked.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Unlock with higher tier</Text>
          {locked.map(o => (
            <OfferCard
              key={o.id}
              offer={o}
              isUnlocked={false}
              isExpanded={false}
              isRedeeming={false}
              code={undefined}
              isCopied={false}
              onToggle={toggleExpand}
              onRedeem={handleRedeem}
              onCopy={copyCode}
            />
          ))}
        </>
      )}

      {tab === 'catalog' && catalog.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🎁</Text>
          <Text style={styles.emptyText}>
            No rewards available yet. Check back soon.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  content: {
    padding: spacing.lg + 2,
    gap: spacing.sm + 2,
    paddingBottom: spacing.xl * 2,
  },
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
    width: 36,
    height: 36,
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMeta: { flex: 1, gap: 2 },
  offerName: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  offerPartner: { ...typography.caption, color: colors.textTertiary },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  offerValue: {
    ...typography.bodySmall,
    fontWeight: '600',
    color: colors.primaryTeal,
  },
  textMuted: { color: colors.textTertiary },

  tierPill: {
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  tierPillText: { ...typography.caption, fontWeight: '500' },

  cardBody: {
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  codeBox: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  codeLabel: { ...typography.caption, color: colors.textTertiary },
  code: {
    ...typography.h3,
    letterSpacing: 2,
    color: colors.textPrimary,
    fontFamily: 'monospace',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
  },
  copyBtnText: {
    ...typography.caption,
    color: colors.primaryTeal,
    fontWeight: '500',
  },
  expiryNote: { ...typography.caption, color: colors.textTertiary },

  redeemBtn: {
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  redeemBtnDisabled: { opacity: 0.5 },
  redeemBtnText: {
    ...typography.bodySmall,
    fontWeight: '500',
    color: colors.white,
  },

  lockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  lockedText: { ...typography.caption, color: colors.textTertiary },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40 },
  emptyText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  tabBar: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: colors.lightTealSurface,
    borderColor: colors.primaryTeal,
  },
  tabBtnText: { ...typography.bodySmall, color: colors.textSecondary },
  tabBtnTextActive: { color: colors.primaryTeal, fontWeight: '600' as const },

  redemptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  redemptionInfo: { flex: 1, gap: 2 },
  redemptionOffer: {
    ...typography.bodySmall,
    fontWeight: '500' as const,
    color: colors.textPrimary,
  },
  redemptionPartner: { ...typography.caption, color: colors.textTertiary },
  redemptionDate: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  codePill: {
    backgroundColor: colors.lightTealSurface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  codePillText: {
    ...typography.caption,
    color: colors.primaryTeal,
    fontWeight: '600' as const,
    fontFamily: 'monospace',
  },
});
