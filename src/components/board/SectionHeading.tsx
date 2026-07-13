// Board pattern: mono eyebrow section label (UPPERCASE + tracked) with an
// optional right-side action. Mirrors PWA src/ui/SectionHeading.
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';

type Props = {
  children: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeading({ children, actionLabel, onAction }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.eyebrow}>{children.toUpperCase()}</Text>
      {actionLabel ? (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.action}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.textTertiary,
  },
  action: {
    fontSize: 13,
    fontFamily: 'IBMPlexSans-SemiBold',
    color: colors.primaryTealText,
  },
});
