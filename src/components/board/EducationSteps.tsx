// Board pattern: numbered how-it-works steps with gold number chips.
// Mirrors PWA src/ui/EducationSteps.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

export type EducationStep = { title: string; body: string };

export function EducationSteps({ steps }: { steps: EducationStep[] }) {
  return (
    <View style={styles.list}>
      {steps.map((s, i) => (
        <View key={s.title} style={styles.row}>
          <View style={styles.chip}>
            <Text style={styles.chipText}>{i + 1}</Text>
          </View>
          <View style={styles.copy}>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  chip: {
    width: 26,
    height: 26,
    borderRadius: radius.pill,
    backgroundColor: colors.cream,
    borderWidth: 1,
    borderColor: '#F0DBB8', // gold-100
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk-Bold',
    color: colors.goldText,
  },
  copy: { flex: 1, gap: 2 },
  title: {
    fontSize: 15,
    fontFamily: 'IBMPlexSans-SemiBold',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'IBMPlexSans-Regular',
    color: colors.textSecondary,
  },
});
