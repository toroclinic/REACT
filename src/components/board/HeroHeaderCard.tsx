// Board pattern: the teal hero header — greeting + avatar, mono eyebrow, big
// Space Grotesk figure, translucent trust pill, children slot (chips/extras).
// Rounded-BOTTOM corners only (radius.hero) so it reads as page chrome.
// Mirrors PWA src/ui/HeroHeaderCard.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '../../theme/tokens';

type Props = {
  greeting: string; // e.g. "Dumela, Neo"
  eyebrow: string; // mono label above the figure, e.g. "HEALTH SCORE"
  figure: string; // the big number/amount, e.g. "72" or "P340.00"
  trustPill?: string; // e.g. "6% premium credit"
  avatarInitials?: string;
  children?: React.ReactNode;
};

export function HeroHeaderCard({
  greeting,
  eyebrow,
  figure,
  trustPill,
  avatarInitials,
  children,
}: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Text style={styles.greeting}>{greeting}</Text>
        {avatarInitials ? (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarInitials}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text>
      <View style={styles.figureRow}>
        <Text style={styles.figure}>{figure}</Text>
        {trustPill ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>{trustPill}</Text>
          </View>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primaryTeal,
    borderBottomLeftRadius: radius.hero,
    borderBottomRightRadius: radius.hero,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  greeting: {
    fontSize: 17,
    fontFamily: 'SpaceGrotesk-Medium',
    color: colors.white,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 14,
    fontFamily: 'SpaceGrotesk-SemiBold',
  },
  eyebrow: { ...typography.eyebrow, color: 'rgba(255,255,255,0.75)' },
  figureRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  figure: {
    fontSize: 40,
    fontFamily: 'SpaceGrotesk-Bold',
    color: colors.white,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  pillText: {
    color: colors.white,
    fontSize: 12,
    fontFamily: 'IBMPlexSans-Medium',
  },
});
