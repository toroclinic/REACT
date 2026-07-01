// Design tokens — mirrors PWA src/index.css CSS variables exactly.
// Dark theme: --color-surface #1E3330 bg, --color-surface-raised #274543 cards.
// Update both files together when the design system changes.
// Do not hardcode hex values outside this file.

export const colors = {
  // ── Toro brand core ──────────────────────────────────────────────────────
  primaryTeal: '#0FBFB4', // --color-primary (Okavango teal)
  primaryTealDark: '#0DA89E', // --color-primary-hover
  primaryTealLight: 'rgba(15,191,180,0.12)', // --color-primary-soft (on dark bg)
  gold: '#D4A843', // --color-accent (Savanna gold)
  goldLight: 'rgba(212,168,67,0.15)', // --color-accent-soft (on dark bg)
  toroInk: '#0D1917', // tab bar deepest dark (web .tab-bar bg)
  toroMuted: '#A8CECA', // --color-text-secondary
  toroBorder: 'rgba(255,255,255,0.11)', // --color-border
  white: '#FFFFFF', // actual white — for text/icons on dark

  // ── Surfaces ─────────────────────────────────────────────────────────────
  screenBg: '#1E3330', // --color-surface   (screen backgrounds)
  surfaceNeutral: '#274543', // --color-surface-raised (cards, inputs)
  lightTealSurface: 'rgba(15,191,180,0.12)', // teal soft wash on dark

  // ── Text ─────────────────────────────────────────────────────────────────
  textPrimary: '#E8F5F4', // --color-text-primary
  textSecondary: '#A8CECA', // --color-text-secondary
  textTertiary: '#7AABA8', // --color-text-muted (unchanged)

  // ── Semantic states (dark-bg variants) ───────────────────────────────────
  successBg: 'rgba(6,95,70,0.25)',
  successText: '#6EE7B7',
  warningBg: 'rgba(120,53,15,0.25)',
  warningText: '#FCD34D',
  dangerBg: 'rgba(153,27,27,0.25)',
  dangerText: '#FCA5A5',

  // ── Tiers (dark bg variants) ──────────────────────────────────────────────
  tierStarting: { bg: 'rgba(6,95,70,0.25)', text: '#6EE7B7' },
  tierBronze: { bg: 'rgba(160,60,15,0.25)', text: '#F4A261' },
  tierSilver: { bg: 'rgba(100,100,110,0.25)', text: '#D4D4D8' },
  tierGold: { bg: 'rgba(180,130,30,0.25)', text: '#FCD34D' },

  // ── Kente stripe ─────────────────────────────────────────────────────────
  kenteTerra: '#D4692E', // --terra2
  kenteGold: '#C49A35', // --gold (kente, not brand gold)
  kenteCobalt: '#75AADB', // --cobalt

  // ── Legacy aliases (kept so existing screens compile) ────────────────────
  heroTeal: '#0FBFB4', // same as primaryTeal
  pulaCardBg: '#0A5C58', // pula card gradient start
  secondaryTeal: '#5DCAA5',
  coral: '#F0997B',
  border: 'rgba(255,255,255,0.11)', // alias of toroBorder
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 6,
  md: 10, // matches PWA --radius-md
  lg: 14, // matches PWA --radius-lg
  xl: 20,
  pill: 99,
} as const;

export const typography = {
  h1: { fontSize: 22, fontWeight: '700' as const },
  h2: { fontSize: 18, fontWeight: '600' as const },
  h3: { fontSize: 16, fontWeight: '500' as const },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: '400' as const, lineHeight: 19 },
  caption: { fontSize: 11, fontWeight: '400' as const },
} as const;

// ── Shared elevation helper ───────────────────────────────────────────────
// Replaces CSS box-shadow with native elevation + shadow props.
export const elevation = {
  card: {
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  cardHigh: {
    elevation: 6,
    shadowColor: '#0D9E8F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
  },
} as const;
