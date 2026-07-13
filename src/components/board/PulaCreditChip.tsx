// Board pattern: "P" coin + amount + "Pula earned" — premium credit rendered
// as earned pula (Decision 1a). One of the few gold-led surfaces.
// Mirrors PWA src/ui/PulaCreditChip.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

type Props = { amount: number; label?: string };

export function PulaCreditChip({ amount, label = 'Pula earned' }: Props) {
  return (
    <View style={styles.chip}>
      <View style={styles.coin}>
        <Text style={styles.coinP}>P</Text>
      </View>
      <Text style={styles.amount}>{`P${amount.toFixed(2)}`}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.cream,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  coin: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinP: { color: colors.white, fontSize: 11, fontFamily: 'SpaceGrotesk-Bold' },
  amount: {
    fontSize: 14,
    fontFamily: 'SpaceGrotesk-SemiBold',
    color: colors.goldText,
  },
  label: {
    fontSize: 12,
    fontFamily: 'IBMPlexSans-Regular',
    color: colors.goldText,
  },
});
