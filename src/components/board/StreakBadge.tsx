// Board pattern: flame + day-count streak chip — one of the few gold-led
// surfaces (streak = earned semantics). Renders null when days <= 0.
// Mirrors PWA src/ui/StreakBadge.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

export function StreakBadge({ days }: { days: number }) {
  if (days <= 0) {
    return null;
  }
  return (
    <View style={styles.badge}>
      <Text style={styles.flame}>🔥</Text>
      <Text style={styles.count}>{days}</Text>
      <Text style={styles.label}>day streak</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.cream,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F0DBB8', // gold-100 hairline on cream
  },
  flame: { fontSize: 14 },
  count: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk-Bold',
    color: colors.goldText,
  },
  label: {
    fontSize: 12,
    fontFamily: 'IBMPlexSans-Medium',
    color: colors.goldText,
  },
});
