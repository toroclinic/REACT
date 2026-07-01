import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  colors,
  radius,
  spacing,
  typography,
  elevation,
} from '../theme/tokens';
import { TaskItem } from '../services/pricingMirror';

// Maps the tabler-style icon names used in the design spec to an
// equivalent MaterialCommunityIcons glyph, since Tabler's icon font isn't
// bundled for React Native by default.
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
      <View style={styles.iconWrap}>
        <Icon
          name={ICON_MAP[task.icon] ?? 'circle'}
          size={18}
          color={colors.primaryTeal}
        />
      </View>
      <Text style={styles.label}>{task.label}</Text>
      <Text style={styles.points}>{task.points}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.toroBorder,
    gap: spacing.sm + 2,
    ...elevation.card,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTealLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
  },
  points: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '600',
  },
});
