// Care-protocol member card (Phase 3) — scheduled tests + the one-time
// completion code shown at the facility desk. Renders null when the member
// has no open scheduled tests (enrollment is admin/scheme-driven). Mirrors
// the PWA's CareProtocolCard; board visual language (hairline borders, no
// shadows, teal accents; gold reserved for rewards).
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { CareProtocolApi } from '../services/api';
import { ScheduledTestView, CompletionCodeIssue } from '../types/api';
import { colors, fonts, radius, spacing, typography } from '../theme/tokens';

interface Props {
  memberId: string;
}

const STATE_LABEL: Record<string, string> = {
  upcoming: 'Upcoming',
  due: 'Due',
  grace: 'Due (grace period)',
  overdue: 'Overdue',
};

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function CareProtocolCard({ memberId }: Props) {
  const [tests, setTests] = useState<ScheduledTestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [codeFor, setCodeFor] = useState<string | null>(null);
  const [issued, setIssued] = useState<CompletionCodeIssue | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    CareProtocolApi.getTests(memberId)
      .then(setTests)
      .catch(() => setTests([]))
      .finally(() => setLoading(false));
  }, [memberId]);

  const open = tests.filter(
    t => t.status !== 'completed_verified' && t.status !== 'expired',
  );

  if (loading || open.length === 0) {
    return null;
  }

  const getCode = async (scheduledTestId: string) => {
    if (issuing) {
      return;
    }
    setIssuing(true);
    setError('');
    try {
      const result = await CareProtocolApi.getCompletionCode(
        memberId,
        scheduledTestId,
      );
      setIssued(result);
      setCodeFor(scheduledTestId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not get a code.');
    } finally {
      setIssuing(false);
    }
  };

  const attestable = new Set(['due', 'grace', 'overdue']);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Scheduled Tests</Text>
        <Text style={styles.subtitle}>
          {open.length} test{open.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {open.map(t => {
        const showingCode = codeFor === t.scheduled_test_id && issued;
        const overdue = t.status === 'overdue';
        return (
          <View key={t.scheduled_test_id} style={styles.row}>
            <View style={styles.rowTop}>
              <View style={styles.rowText}>
                <Text style={styles.label}>{t.label}</Text>
                <Text style={styles.meta}>
                  Due {formatDate(t.due_date)} ·{' '}
                  <Text style={overdue ? styles.stateOverdue : styles.stateOk}>
                    {STATE_LABEL[t.status] ?? t.status}
                  </Text>
                </Text>
              </View>
              {attestable.has(t.status) && !showingCode ? (
                <TouchableOpacity
                  style={[styles.codeBtn, issuing && styles.codeBtnDim]}
                  disabled={issuing}
                  onPress={() => getCode(t.scheduled_test_id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Get completion code for ${t.label}`}
                >
                  <Text style={styles.codeBtnText}>
                    {issuing ? '…' : 'Get code'}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {showingCode && issued ? (
              <View style={styles.codeBox}>
                <Text style={styles.codeHint}>
                  SHOW THIS CODE AT THE FACILITY DESK
                </Text>
                <Text style={styles.code}>{issued.code}</Text>
                <Text style={styles.codeMeta}>
                  Valid {issued.valid_minutes} minutes · earns P
                  {issued.credit_preview_pula.toFixed(2)}
                  {issued.on_time ? ' (on time)' : ''}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.toroBorder,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15,
    fontFamily: fonts.display600,
    color: colors.textPrimary,
  },
  subtitle: { ...typography.eyebrow, color: colors.primaryTealText },
  row: {
    borderTopWidth: 1,
    borderTopColor: colors.toroBorder,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rowText: { flex: 1 },
  label: {
    fontSize: 14,
    fontFamily: fonts.body600,
    color: colors.textPrimary,
  },
  meta: { ...typography.caption, color: colors.textTertiary, marginTop: 2 },
  stateOk: { color: colors.primaryTealText, fontFamily: fonts.body600 },
  stateOverdue: { color: colors.dangerText, fontFamily: fonts.body600 },
  codeBtn: {
    backgroundColor: colors.primaryTeal,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  codeBtnDim: { opacity: 0.5 },
  codeBtnText: {
    fontSize: 13,
    fontFamily: fonts.body600,
    color: colors.white,
  },
  codeBox: {
    backgroundColor: colors.mintWash,
    borderWidth: 1,
    borderColor: colors.primaryTeal,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  codeHint: { ...typography.eyebrow, fontSize: 9, color: colors.textTertiary },
  code: {
    fontSize: 30,
    fontFamily: fonts.mono500,
    letterSpacing: 6,
    color: colors.textPrimary,
  },
  codeMeta: { ...typography.caption, color: colors.textSecondary },
  error: { ...typography.caption, color: colors.dangerText },
});
