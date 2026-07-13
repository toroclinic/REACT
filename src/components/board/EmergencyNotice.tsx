// Board pattern: the emergency invariant line. FIXED COPY — do not vary:
// "Emergency? Care first, wallet later — emergencies are never gated."
// Emergency Red is reserved for this class of notice (never form errors).
// Mirrors PWA src/ui/EmergencyNotice.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

export function EmergencyNotice() {
  return (
    <View style={styles.card}>
      <View style={styles.stripe} />
      <Text style={styles.text}>
        <Text style={styles.lead}>Emergency? </Text>
        Care first, wallet later — emergencies are never gated.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.toroBorder,
    overflow: 'hidden',
  },
  stripe: {
    width: 4,
    alignSelf: 'stretch',
    backgroundColor: colors.emergencyRed,
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: 'IBMPlexSans-Regular',
    color: colors.textSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  lead: { fontFamily: 'IBMPlexSans-SemiBold', color: colors.textPrimary },
});
