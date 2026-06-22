import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

interface TierProgressBarProps {
  score: number; // 0-100
}

export function TierProgressBar({ score }: TierProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  return (
    <View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${clamped}%` }]} />
      </View>
      <View style={styles.labels}>
        <Text style={styles.labelText}>Bronze</Text>
        <Text style={styles.labelText}>Silver</Text>
        <Text style={styles.labelText}>Gold</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceNeutral,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primaryTeal,
    borderRadius: 3,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs + 2,
  },
  labelText: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
