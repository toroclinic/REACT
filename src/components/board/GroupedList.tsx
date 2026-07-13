// Board pattern: mono day-group headers (TODAY / YESTERDAY / weekday + date)
// for transaction/history lists, plus the grouping helper. Mirrors PWA
// src/ui/GroupedList.
import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '../../theme/tokens';

export function DayHeader({ date }: { date: string | Date }) {
  return <Text style={styles.header}>{dayLabel(date)}</Text>;
}

/** TODAY / YESTERDAY / "MONDAY 6 JUL" — always uppercase mono. */
export function dayLabel(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) {
    return 'TODAY';
  }
  if (diffDays === 1) {
    return 'YESTERDAY';
  }
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const day = d.getDate();
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  return `${weekday} ${day} ${month}`.toUpperCase();
}

/** Group items by calendar day (newest first) using a date accessor. */
export function groupByDay<T>(
  items: T[],
  getDate: (item: T) => string,
): { day: string; items: T[] }[] {
  const groups: { day: string; items: T[] }[] = [];
  for (const item of items) {
    const day = dayLabel(getDate(item));
    const last = groups[groups.length - 1];
    if (last && last.day === day) {
      last.items.push(item);
    } else {
      groups.push({ day, items: [item] });
    }
  }
  return groups;
}

const styles = StyleSheet.create({
  header: {
    ...typography.eyebrow,
    color: colors.textTertiary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
});
