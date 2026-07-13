// Board pattern: dark pine pill "<5 MIN · Clinic escalation" — escalation
// context marker (pay screen, alerts). Mirrors PWA src/ui/EscalationBadge.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';

export function EscalationBadge({ minutes = 5 }: { minutes?: number }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.text}>{`<${minutes} MIN · CLINIC ESCALATION`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.pine,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  text: {
    ...typography.eyebrow,
    color: colors.white,
  },
});
