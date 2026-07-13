// Board pattern: mint-wash pill tag. Mirrors PWA src/ui/MintTag.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme/tokens';

export function MintTag({ children }: { children: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.text}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: colors.mintWash,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  text: {
    fontSize: 12,
    fontFamily: 'IBMPlexSans-Medium',
    color: '#085E55', // teal-800 — AA on mint wash
  },
});
