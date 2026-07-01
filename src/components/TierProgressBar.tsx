import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../theme/tokens';

const MILESTONES = [
  { name: 'Bronze', pct: 25 },
  { name: 'Silver', pct: 50 },
  { name: 'Gold', pct: 75 },
];

interface TierProgressBarProps {
  score: number; // 0–100
}

export function TierProgressBar({ score }: TierProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, score));
  const nextTier = MILESTONES.find(t => score < t.pct);
  const ptsToNext = nextTier ? nextTier.pct - score : null;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: score }}
    >
      <View style={styles.header}>
        <Text
          style={styles.scoreLabel}
          accessibilityLabel={`${score} wellness points`}
        >
          {score} pts
        </Text>
        {ptsToNext !== null && nextTier ? (
          <Text style={styles.nextLabel}>
            {ptsToNext} pts to {nextTier.name}
          </Text>
        ) : (
          <Text style={[styles.nextLabel, { color: colors.gold }]}>
            Gold — max tier reached
          </Text>
        )}
      </View>

      <View style={styles.track}>
        <View
          style={[styles.fill, { width: `${clamped}%` as unknown as number }]}
        />
        {MILESTONES.map(m => (
          <View
            key={m.name}
            style={[styles.marker, { left: `${m.pct}%` as unknown as number }]}
          />
        ))}
      </View>

      <View style={styles.labelRow}>
        {MILESTONES.map(m => (
          <Text
            key={m.name}
            style={[styles.labelText, score >= m.pct && styles.labelTextActive]}
          >
            {m.name}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primaryTeal,
  },
  nextLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.toroBorder,
    overflow: 'visible',
    position: 'relative',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primaryTeal,
    borderRadius: 4,
  },
  marker: {
    position: 'absolute',
    top: -2,
    width: 2,
    height: 12,
    backgroundColor: colors.white,
    borderRadius: 1,
    marginLeft: -1,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs + 2,
    paddingHorizontal: '5%',
  },
  labelText: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  labelTextActive: {
    color: colors.primaryTeal,
  },
});
