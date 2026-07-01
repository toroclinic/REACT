import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyTasks } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface Props {
  serverTasks?: DailyTasks | null;
  profileTasks?: {
    blood_pressure: boolean;
    activity: boolean;
    medication: boolean;
  };
  onNavigate?: (screen: string) => void;
}

const WATER_GOAL = 8;
const WATER_KEY = 'wellness:water_glasses_';

function todayKey() {
  return WATER_KEY + new Date().toISOString().slice(0, 10);
}

export function DailyTasksCard({
  serverTasks,
  profileTasks,
  onNavigate,
}: Props) {
  const [water, setWater] = useState(0);
  const loadedRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(todayKey())
      .then(v => {
        loadedRef.current = true;
        if (v !== null) {
          setWater(parseInt(v, 10) || 0);
        }
      })
      .catch(() => {
        loadedRef.current = true; /* AsyncStorage unavailable */
      });
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      return;
    }
    AsyncStorage.setItem(todayKey(), String(water));
  }, [water]);

  const merged: DailyTasks = {
    medication: profileTasks?.medication ?? serverTasks?.medication ?? false,
    blood_pressure:
      profileTasks?.blood_pressure ?? serverTasks?.blood_pressure ?? false,
    activity: profileTasks?.activity ?? serverTasks?.activity ?? false,
    water: water >= WATER_GOAL,
  };

  const done = Object.values(merged).every(Boolean);

  const taskItems = [
    {
      key: 'medication',
      label: 'Medication',
      icon: '💊',
      done: merged.medication,
      target: 'Screening',
    },
    {
      key: 'blood_pressure',
      label: 'BP check',
      icon: '❤️',
      done: merged.blood_pressure,
      target: 'Screening',
    },
    {
      key: 'activity',
      label: 'Activity check-in',
      icon: '🏃',
      done: merged.activity,
      target: 'Activity',
    },
    {
      key: 'water',
      label: 'Water (8 glasses)',
      icon: '💧',
      done: merged.water,
      target: null,
    },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Today's tasks</Text>
      {done ? (
        <View style={styles.allDone}>
          <Text style={styles.allDoneIcon}>🎉</Text>
          <Text style={styles.allDoneText}>All done for today!</Text>
        </View>
      ) : (
        taskItems.map(item => (
          <TouchableOpacity
            key={item.key}
            style={styles.row}
            onPress={() => item.target && onNavigate?.(item.target)}
            disabled={item.done || !item.target}
            activeOpacity={0.7}
            accessibilityRole={item.target ? 'button' : 'none'}
            accessibilityLabel={`${item.label}${
              item.done ? ', completed' : ''
            }`}
            accessibilityHint={
              !item.done && item.target
                ? `Go to ${item.target} screen`
                : undefined
            }
            accessibilityState={{ disabled: item.done }}
          >
            <View
              style={[styles.check, item.done && styles.checkDone]}
              accessibilityElementsHidden
            >
              {item.done && <Text style={styles.checkMark}>✓</Text>}
            </View>
            <Text style={styles.icon} accessibilityElementsHidden>
              {item.icon}
            </Text>
            <Text style={[styles.label, item.done && styles.labelDone]}>
              {item.label}
            </Text>
            {item.key === 'water' && !item.done && (
              <View style={styles.waterBtns}>
                <TouchableOpacity
                  style={styles.waterBtn}
                  onPress={() => setWater(w => Math.max(0, w - 1))}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove one glass, currently ${water} of ${WATER_GOAL}`}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                >
                  <Text style={styles.waterBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.waterCount} accessibilityElementsHidden>
                  {water}/{WATER_GOAL}
                </Text>
                <TouchableOpacity
                  style={styles.waterBtn}
                  onPress={() => setWater(w => Math.min(WATER_GOAL, w + 1))}
                  accessibilityRole="button"
                  accessibilityLabel={`Add one glass, currently ${water} of ${WATER_GOAL}`}
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                >
                  <Text style={styles.waterBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            )}
          </TouchableOpacity>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkDone: { backgroundColor: colors.heroTeal, borderColor: colors.heroTeal },
  checkMark: { color: colors.white, fontSize: 12, fontWeight: '700' as const },
  icon: { fontSize: 16 },
  label: { ...typography.body, color: colors.textPrimary, flex: 1 },
  labelDone: { color: colors.textTertiary, textDecorationLine: 'line-through' },
  waterBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  waterBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceNeutral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waterBtnText: { ...typography.h3, color: colors.textPrimary },
  waterCount: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    minWidth: 32,
    textAlign: 'center',
  },
  allDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  allDoneIcon: { fontSize: 20 },
  allDoneText: {
    ...typography.body,
    color: colors.primaryTeal,
    fontWeight: '500' as const,
  },
});
