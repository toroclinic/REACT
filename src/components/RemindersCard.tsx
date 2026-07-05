import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { RemindersApi } from '../services/api';
import { MemberReminder } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface Props {
  memberId: string;
}

const URGENCY_BG: Record<string, string> = {
  urgent: colors.dangerBg,
  due: colors.warningBg,
  upcoming: colors.successBg,
};
const URGENCY_COLOR: Record<string, string> = {
  urgent: colors.dangerText,
  due: colors.warningText,
  upcoming: colors.successText,
};

export function RemindersCard({ memberId }: Props) {
  const [reminders, setReminders] = useState<MemberReminder[]>([]);

  useEffect(() => {
    RemindersApi.getReminders(memberId)
      .then(setReminders)
      .catch(() => setReminders([]));
  }, [memberId]);

  const dismiss = async (reminderId: string) => {
    setReminders(prev => prev.filter(r => r.reminder_id !== reminderId));
    await RemindersApi.dismiss(reminderId).catch(() => {});
  };

  if (reminders.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {reminders.map(r => {
        const bg = URGENCY_BG[r.urgency] ?? URGENCY_BG.upcoming;
        const color = URGENCY_COLOR[r.urgency] ?? URGENCY_COLOR.upcoming;
        return (
          <View
            key={r.reminder_id}
            style={[styles.card, { backgroundColor: bg }]}
          >
            <View style={styles.row}>
              <Text style={[styles.title, { color }]}>{r.title}</Text>
              <TouchableOpacity
                onPress={() => dismiss(r.reminder_id)}
                style={styles.dismissBtn}
              >
                <Text style={[styles.dismissText, { color }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.message, { color }]}>{r.message}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginBottom: spacing.md },
  card: { borderRadius: radius.lg, padding: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  title: { ...typography.bodySmall, fontWeight: '600' as const, flex: 1 },
  dismissBtn: { padding: 2, marginLeft: spacing.sm },
  dismissText: { fontSize: 14 },
  message: { ...typography.bodySmall },
});
