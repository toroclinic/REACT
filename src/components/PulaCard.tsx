// The pula card — the product's signature visual element (see Frontend &
// Backend Spec, Section 2). "Pula" means both rain and currency in
// Setswana; the falling-rain motif behind the credit number is a deliberate
// nod to the product's core mechanic, not decoration.
//
// Mirrors PWA .pula-card: gradient #0A5C58 → #0D7A74 → #0F8C84, radius-lg,
// and native elevation replacing CSS box-shadow.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, spacing, elevation } from '../theme/tokens';
import { Tier } from '../types/api';

interface PulaCardProps {
  creditPct: number;
  tier: Tier;
  score: number;
  annualPremiumBwp?: number | null;
}

export function PulaCard({
  creditPct,
  tier,
  score,
  annualPremiumBwp,
}: PulaCardProps) {
  const savingBwp = annualPremiumBwp
    ? Math.round((annualPremiumBwp * creditPct) / 100)
    : null;

  return (
    <View style={styles.card}>
      {/* Pula rain motif — same SVG path as the PWA */}
      <Svg
        width="100%"
        height={64}
        viewBox="0 0 320 64"
        style={styles.rainSvg}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Path
          d="M0 50 Q 40 20 80 50 T 160 50 T 240 50 T 320 50"
          stroke={colors.secondaryTeal}
          strokeWidth={2}
          fill="none"
        />
      </Svg>

      <Text style={styles.label}>Your premium credit</Text>
      <View style={styles.creditRow}>
        <Text style={styles.creditValue}>{creditPct}%</Text>
        <Text style={styles.creditSuffix}>off at renewal</Text>
      </View>
      {savingBwp !== null && savingBwp > 0 && (
        <Text style={styles.saving}>
          You save P{savingBwp.toLocaleString()} this year
        </Text>
      )}

      <View style={styles.tierRow}>
        <View style={styles.dot} />
        <Text style={styles.tierText}>
          {tier} tier · score {score}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Gradient approximated as mid-point flat colour (#0D7A74) — native gradient
  // requires react-native-linear-gradient; flat colour preserves the dark-teal
  // identity without adding a dependency.
  card: {
    backgroundColor: '#0D7A74',
    borderRadius: radius.lg,
    padding: 20,
    overflow: 'hidden',
    ...elevation.cardHigh,
  },
  rainSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.22,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  // Credit value matches PWA .pula-card-credit-value: 42px 800
  creditValue: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -2,
    lineHeight: 44,
  },
  creditSuffix: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  saving: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '600',
    marginTop: spacing.xs,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm + 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  tierText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
});
