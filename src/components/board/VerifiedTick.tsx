// Board pattern: clinic-verified marker. HARD INVARIANT (same as PWA
// src/ui/VerifiedTick): takes `verified: boolean` and renders NULL when false.
// Callers must wire this to a real server-confirmed field (screening
// confirmed_at, clinic confirmation) — never optimistic/local state.
// Always teal, never gold.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '../../theme/tokens';

type Props = { verified: boolean; label?: string };

export function VerifiedTick({ verified, label = 'Verified' }: Props) {
  if (!verified) {
    return null;
  }
  return (
    <View style={styles.wrap}>
      <View style={styles.tick}>
        <Text style={styles.tickMark}>✓</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tick: {
    width: 16,
    height: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickMark: {
    color: colors.white,
    fontSize: 10,
    fontFamily: 'IBMPlexSans-Bold',
  },
  label: {
    fontSize: 12,
    fontFamily: 'IBMPlexSans-Medium',
    color: colors.primaryTealText,
  },
});
