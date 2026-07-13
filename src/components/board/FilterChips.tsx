// Board pattern: pill filter row — active chip = Deep Pine fill + white text,
// inactive = white + hairline border + slate text. Mirrors PWA src/ui/FilterChips.
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

type Chip = { key: string; label: string };
type Props = {
  chips: Chip[];
  active: string;
  onChange: (key: string) => void;
};

export function FilterChips({ chips, active, onChange }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {chips.map(c => {
        const isActive = c.key === active;
        return (
          <TouchableOpacity
            key={c.key}
            onPress={() => onChange(c.key)}
            style={[styles.chip, isActive ? styles.chipActive : null]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.label, isActive ? styles.labelActive : null]}>
              {c.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceNeutral,
    borderWidth: 1,
    borderColor: colors.toroBorder,
    minHeight: 44, // touch-target floor
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: colors.pine,
    borderColor: colors.pine,
  },
  label: {
    fontSize: 13,
    fontFamily: 'IBMPlexSans-Medium',
    color: colors.textSecondary,
  },
  labelActive: { color: colors.white },
});
