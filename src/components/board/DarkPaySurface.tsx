// Board pattern: the Deep Pine payment surface — dark wrapper, white
// radius-20 inner card, optional stat chips row, mono wallet id footer.
// Deep Pine is a deliberate dark ACCENT surface (payments/escalation), the
// one sanctioned dark context in the light system. Styles the EXISTING
// pay flow — no QR, no new payment features. Mirrors PWA src/ui/DarkPayScreen.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';

type Stat = { label: string; value: string };
type Props = {
  title: string;
  stats?: Stat[];
  walletId?: string;
  children: React.ReactNode; // the pay form / content on the white card
};

export function DarkPaySurface({ title, stats, walletId, children }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {stats && stats.length > 0 ? (
        <View style={styles.statsRow}>
          {stats.map(s => (
            <View key={s.label} style={styles.statChip}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      ) : null}
      <View style={styles.card}>{children}</View>
      {walletId ? (
        <Text style={styles.walletId}>{walletId.toUpperCase()}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.pine,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  title: {
    fontSize: 17,
    fontFamily: 'SpaceGrotesk-SemiBold',
    color: colors.white,
  },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statChip: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 1,
  },
  statValue: {
    fontSize: 15,
    fontFamily: 'SpaceGrotesk-SemiBold',
    color: colors.white,
  },
  statLabel: {
    ...typography.eyebrow,
    fontSize: 9,
    color: 'rgba(255,255,255,0.65)',
  },
  card: {
    backgroundColor: colors.surfaceNeutral,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  walletId: {
    ...typography.eyebrow,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
});
