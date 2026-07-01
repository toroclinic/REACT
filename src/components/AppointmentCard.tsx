import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Appointment } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface Props {
  appointment: Appointment;
}

const STATUS_COLOR: Record<string, string> = {
  scheduled: colors.heroTeal,
  confirmed: colors.primaryTeal,
  completed: colors.textTertiary,
  cancelled: '#991B1B',
  pending: '#D97706',
};

export function AppointmentCard({ appointment: appt }: Props) {
  const color = STATUS_COLOR[appt.status] ?? colors.textSecondary;
  const date = new Date(appt.appointment_date).toLocaleDateString('en-BW', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });

  return (
    <View style={styles.card}>
      <View style={styles.leftBar} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.location}>{appt.location}</Text>
          <View style={[styles.statusBadge, { backgroundColor: `${color}22` }]}>
            <Text style={[styles.statusText, { color }]}>{appt.status}</Text>
          </View>
        </View>
        <Text style={styles.date}>
          {date}
          {appt.appointment_time ? ` · ${appt.appointment_time}` : ''}
        </Text>
        {appt.notes && <Text style={styles.notes}>{appt.notes}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceNeutral,
  },
  leftBar: { width: 4, backgroundColor: colors.heroTeal },
  content: { flex: 1, padding: spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  location: { ...typography.h3, color: colors.textPrimary, flex: 1 },
  statusBadge: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600' as const,
    textTransform: 'capitalize',
  },
  date: { ...typography.bodySmall, color: colors.textSecondary },
  notes: {
    ...typography.caption,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
});
