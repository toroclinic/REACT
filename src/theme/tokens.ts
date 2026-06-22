// Design tokens — matches Wellness+ Frontend & Backend Spec, Section 2.
// Source of truth for color, type, and spacing across the app.
// Do not hardcode hex values outside this file.

export const colors = {
  // Pula card / primary teal family ("pula" = rain and currency in Setswana —
  // the premium falling as engagement rises is the product's core metaphor)
  pulaCardBg: '#04342C',
  primaryTeal: '#0F6E56',
  secondaryTeal: '#5DCAA5',
  lightTealSurface: '#E1F5EE',

  // Secondary accent
  coral: '#F0997B',

  // Neutrals
  textPrimary: '#1B2A4A',
  textSecondary: '#5A6472',
  textTertiary: '#888780',
  surfaceNeutral: '#F2F4F7',
  white: '#FFFFFF',
  border: '#D9DDE3',

  // Tier colors (Section 2.3 / pricing spec Section 2.4)
  tierStarting: { bg: '#E1F5EE', text: '#04342C' },
  tierBronze: { bg: '#FAECE7', text: '#4A1B0C' },
  tierSilver: { bg: '#F1EFE8', text: '#2C2C2A' },
  tierGold: { bg: '#FAEEDA', text: '#412402' },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  md: 8,
  lg: 12,
  xl: 16,
} as const;

export const typography = {
  // System sans-serif per platform (SF Pro on iOS), weight 500 only for
  // headings per spec — kept calm against a data-heavy task list.
  h1: { fontSize: 22, fontWeight: '500' as const },
  h2: { fontSize: 18, fontWeight: '500' as const },
  h3: { fontSize: 16, fontWeight: '500' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19 },
  caption: { fontSize: 11, fontWeight: '400' as const },
};
