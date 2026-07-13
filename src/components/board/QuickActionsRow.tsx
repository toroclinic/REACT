// Board pattern: three primary action buttons — teal / pine / orange variants.
// Orange is the PAYMENT-RAIL colour: only ever the top-up/Orange-Money action.
// Mirrors PWA src/ui/QuickActionsRow.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

export type QuickAction = {
  label: string;
  icon?: string; // emoji/text glyph
  variant: 'teal' | 'pine' | 'orange';
  onPress: () => void;
};

const VARIANT_BG: Record<QuickAction['variant'], string> = {
  teal: colors.primaryTeal,
  pine: colors.pine,
  orange: colors.orangeMoney,
};

export function QuickActionsRow({ actions }: { actions: QuickAction[] }) {
  return (
    <View style={styles.row}>
      {actions.map(a => (
        <TouchableOpacity
          key={a.label}
          style={[styles.btn, { backgroundColor: VARIANT_BG[a.variant] }]}
          onPress={a.onPress}
          accessibilityRole="button"
        >
          {a.icon ? <Text style={styles.icon}>{a.icon}</Text> : null}
          <Text style={styles.label}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flex: 1,
    minHeight: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.md,
  },
  icon: { fontSize: 18 },
  label: {
    color: colors.white,
    fontSize: 12,
    fontFamily: 'IBMPlexSans-SemiBold',
  },
});
