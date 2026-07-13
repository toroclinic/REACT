import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { ChronicCareApi } from '../services/api';
import { ChronicCareVisit } from '../types/api';
import { colors, radius, spacing, typography } from '../theme/tokens';

interface Props {
  memberId: string;
}

const URGENCY_COLOR: Record<string, string> = {
  overdue: colors.dangerText,
  due_soon: colors.warningText,
  upcoming: colors.heroTeal,
};

export function ChronicCareCard({ memberId }: Props) {
  const [visits, setVisits] = useState<ChronicCareVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    ChronicCareApi.getVisits(memberId)
      .then(v => setVisits(v.filter(x => x.status !== 'completed')))
      .catch(() => setVisits([]))
      .finally(() => setLoading(false));
  }, [memberId]);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.primaryTeal} size="small" />
      </View>
    );
  }

  if (visits.length === 0) {
    return null;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Chronic care visits</Text>
      {visits.map(v => {
        const color = v.urgency
          ? URGENCY_COLOR[v.urgency]
          : colors.textSecondary;
        const isOpen = expanded === v.visit_id;
        return (
          <TouchableOpacity
            key={v.visit_id}
            style={styles.row}
            onPress={() => setExpanded(isOpen ? null : v.visit_id)}
            activeOpacity={0.7}
          >
            <View style={[styles.dot, { backgroundColor: color }]} />
            <View style={styles.rowContent}>
              <Text style={styles.conditionLabel}>{v.condition_label}</Text>
              <Text style={[styles.dueDate, { color }]}>
                Due:{' '}
                {new Date(v.due_date).toLocaleDateString('en-BW', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
                {v.urgency === 'overdue'
                  ? ' · OVERDUE'
                  : v.urgency === 'due_soon'
                  ? ' · Due soon'
                  : ''}
              </Text>
              {isOpen && v.expected_labs.length > 0 && (
                <View style={styles.labsRow}>
                  <Text style={styles.labsLabel}>Expected tests:</Text>
                  {v.expected_labs.map(lab => (
                    <View key={lab} style={styles.labTag}>
                      <Text style={styles.labTagText}>{lab}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
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
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  rowContent: { flex: 1 },
  conditionLabel: { ...typography.body, color: colors.textPrimary },
  dueDate: { ...typography.bodySmall, marginTop: 2 },
  labsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  labsLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    width: '100%',
  },
  labTag: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  labTagText: { ...typography.caption, color: colors.textSecondary },
});
