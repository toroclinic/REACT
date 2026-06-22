import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { TaskItem } from '../services/pricingMirror';

// Maps the tabler-style icon names used in the design spec to an
// equivalent MaterialCommunityIcons glyph, since Tabler's icon font isn't
// bundled for React Native by default. Swap for a Tabler RN package if the
// design team wants pixel-identical icons to the prototype.
const ICON_MAP: Record<string, string> = {
  'ti-heart-rate-monitor': 'heart-pulse',
  'ti-droplet-half-2': 'water-percent',
  'ti-walk': 'walk',
  'ti-pill': 'pill',
};

interface TaskRowProps {
  task: TaskItem;
  onPress: () => void;
}

export function TaskRow({ task, onPress }: TaskRowProps) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${task.label}, ${task.points}`}
    >
      <View style={styles.left}>
        <Icon name={ICON_MAP[task.icon] ?? 'circle'} size={18} color={colors.primaryTeal} />
        <Text style={styles.label}>{task.label}</Text>
      </View>
      <Text style={styles.points}>{task.points}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg - 2,
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flexShrink: 1,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flexShrink: 1,
  },
  points: {
    ...typography.caption,
    color: colors.textTertiary,
  },
});
