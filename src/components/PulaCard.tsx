// The pula card — the product's signature visual element (see Frontend &
// Backend Spec, Section 2). "Pula" means both rain and currency in
// Setswana; the falling-rain motif behind the credit number is a deliberate
// nod to the product's core mechanic, not decoration.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { Tier } from '../types/api';

interface PulaCardProps {
  creditPct: number;
  tier: Tier;
  score: number;
}

export function PulaCard({ creditPct, tier, score }: PulaCardProps) {
  return (
    <View style={styles.card}>
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

      <View style={styles.tierRow}>
        <View style={styles.dot} />
        <Text style={styles.tierText}>
          {tier} tier &middot; score {score}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.pulaCardBg,
    borderRadius: radius.lg,
    padding: spacing.lg + 2,
    overflow: 'hidden',
    position: 'relative',
  },
  rainSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.35,
  },
  label: {
    ...typography.bodySmall,
    color: colors.secondaryTeal,
    marginBottom: spacing.xs + 2,
  },
  creditRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs + 2,
  },
  creditValue: {
    fontSize: 36,
    fontWeight: '500',
    color: colors.lightTealSurface,
  },
  creditSuffix: {
    ...typography.bodySmall,
    color: colors.secondaryTeal,
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.sm + 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondaryTeal,
  },
  tierText: {
    ...typography.caption,
    color: colors.secondaryTeal,
  },
});
