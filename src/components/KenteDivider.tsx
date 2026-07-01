import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';

// Mirrors the PWA .kente-divider — a 4-segment repeating stripe in
// terra2 / gold / cobalt / white, drawn as flex children instead of
// a CSS repeating-linear-gradient (no native equivalent).
export function KenteDivider() {
  return (
    <View style={styles.stripe}>
      <View style={[styles.seg, { backgroundColor: colors.kenteTerra }]} />
      <View style={[styles.seg, { backgroundColor: colors.kenteGold }]} />
      <View style={[styles.seg, { backgroundColor: colors.kenteCobalt }]} />
      <View style={[styles.seg, { backgroundColor: colors.white }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  stripe: {
    flexDirection: 'row',
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginVertical: 6,
  },
  seg: {
    flex: 1,
  },
});
