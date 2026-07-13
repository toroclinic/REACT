// Board pattern: month roll-up — Saved / Spent on care / Bonuses (gold).
// Values are aggregated by the CALLER from real transactions (completed only);
// this component renders, it never invents. Mirrors PWA src/ui/MonthSummaryCard.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

type Props = { saved: number; spentOnCare: number; bonuses: number };

export function MonthSummaryCard({ saved, spentOnCare, bonuses }: Props) {
  return (
    <View style={styles.card}>
      <Stat label="Saved" value={saved} />
      <View style={styles.divider} />
      <Stat label="Spent on care" value={spentOnCare} />
      <View style={styles.divider} />
      <Stat label="Bonuses" value={bonuses} gold />
    </View>
  );
}

function Stat({
  label,
  value,
  gold,
}: {
  label: string;
  value: number;
  gold?: boolean;
}) {
  return (
    <View style={styles.stat}>
      <Text
        style={[styles.value, gold ? styles.goldValue : null]}
      >{`P${value.toFixed(0)}`}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.toroBorder,
    paddingVertical: spacing.lg,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  divider: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: colors.toroBorder,
  },
  value: {
    fontSize: 18,
    fontFamily: 'SpaceGrotesk-SemiBold',
    color: colors.textPrimary,
  },
  goldValue: { color: colors.goldText },
  label: {
    fontSize: 11,
    fontFamily: 'IBMPlexSans-Regular',
    color: colors.textTertiary,
  },
});
