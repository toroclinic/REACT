// Design tokens — mirrors PWA src/index.css CSS variables exactly.
// "Addendum 2" board visual language (light): Paper background, hairline-
// bordered white cards (NO shadows — depth from border + tint), Toro Teal
// primary, Gold reserved for rewards/earned-pula/streak semantics, Deep Pine
// for dark accent surfaces + text-on-light, Orange Money for the payment rail
// only, Emergency Red for escalation notices only.
// Update both files together when the design system changes.
// Do not hardcode hex values outside this file.

export const colors = {
  // ── Toro brand core ──────────────────────────────────────────────────────
  primaryTeal: '#0D9E8F', // --teal-500 / --color-primary
  primaryTealDark: '#0B8A7D', // --teal-600 / --color-primary-hover
  primaryTealText: '#0A7A6E', // --teal-700 — AA teal text on white/paper
  primaryTealLight: '#DCF0EB', // --mint-wash / --color-primary-soft
  gold: '#C8873A', // --gold-500 — rewards/earned-pula/streak ONLY
  goldText: '#8A5A24', // --gold-700 — AA-safe gold text
  goldLight: 'rgba(200,135,58,0.14)', // --color-accent-soft
  pine: '#0A302E', // --pine-900 — dark accent surfaces + primary text-on-light
  mintWash: '#DCF0EB', // --mint-wash — tags, icon tiles, soft chips
  cream: '#FBF3E2', // --cream — reward/bonus card fill (gold contexts only)
  orangeMoney: '#FF7900', // payment-rail only: top-up CTA, "powered by" slot
  emergencyRed: '#FF5445', // emergency/escalation notices only
  toroInk: '#FFFFFF', // tab bar bg (light system — was the dark ink)
  toroMuted: '#4A5F5C', // --color-text-secondary (Slate)
  toroBorder: '#E4EEEB', // --color-border (Hairline)
  borderStrong: '#C9DEDA', // --color-border-strong
  white: '#FFFFFF', // actual white — button text on teal/pine, etc.

  // ── Surfaces ─────────────────────────────────────────────────────────────
  screenBg: '#F7FAF9', // Paper — app background (--color-bg)
  surfaceNeutral: '#FFFFFF', // cards, inputs (--color-surface-raised)
  surfaceSunken: '#F1F7F5', // --color-surface — sunken/secondary surfaces
  lightTealSurface: '#DCF0EB', // mint wash

  // ── Text ─────────────────────────────────────────────────────────────────
  textPrimary: '#0A302E', // Pine — --color-text-primary
  textSecondary: '#4A5F5C', // Slate — --color-text-secondary
  textTertiary: '#6E8985', // --color-text-muted

  // ── Semantic states (light variants; generic danger is DISTINCT from
  //    Emergency Red so the emergency signal never dilutes) ─────────────────
  successBg: '#E3F5EC',
  successText: '#0B6B44',
  warningBg: '#FDF3E0',
  warningText: '#8F5E0A',
  dangerBg: '#FDEBEA',
  dangerText: '#C4362A',

  // ── Tiers (light variants; gold reserved for Gold tier) ──────────────────
  tierStarting: { bg: '#DCF0EB', text: '#085E55' },
  tierBronze: { bg: '#F0DBC4', text: '#9C4F1E' },
  tierSilver: { bg: '#E7EFED', text: '#52616B' },
  tierGold: { bg: '#FBF3E2', text: '#8A5A24' },

  // ── Kente stripe ─────────────────────────────────────────────────────────
  kenteTerra: '#D4692E', // --terra2
  kenteGold: '#C49A35', // kente gold (decorative, not brand gold)
  kenteCobalt: '#75AADB', // also the map "you are here" pin (--color-location)

  // ── Map location pin (matches PWA --color-location) ─────────────────────
  location: '#75AADB',

  // ── Legacy aliases (kept so existing screens compile; re-pointed to the
  //    board palette — sweep call sites onto real tokens in U2–U5) ──────────
  heroTeal: '#0D9E8F', // same as primaryTeal
  pulaCardBg: '#0A302E', // pula/pay dark surface is Deep Pine now
  secondaryTeal: '#8FDCD0', // --teal-200
  coral: '#C4362A', // was decorative coral; nearest board-legal use is danger text
  border: '#E4EEEB', // alias of toroBorder
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
  md: 13, // matches PWA --radius-md
  lg: 15, // matches PWA --radius-lg
  xl: 20,
  hero: 26, // HeroHeaderCard rounded-bottom
  pill: 99,
} as const;

// ── Typography ──────────────────────────────────────────────────────────────
// Three families, same as the PWA: Space Grotesk (display/headings/amounts/
// buttons), IBM Plex Sans (body/UI), IBM Plex Mono (eyebrows, IDs, timestamps,
// captions, day-group headers, tags — always UPPERCASE + tracked).
// Android resolves custom fonts by FILE name, so each weight is its own
// family string and fontWeight must stay unset where these are used (setting
// both can double-embolden on Android). Files live in assets/fonts/.
export const fonts = {
  display500: 'SpaceGrotesk-Medium',
  display600: 'SpaceGrotesk-SemiBold',
  display700: 'SpaceGrotesk-Bold',
  body400: 'IBMPlexSans-Regular',
  body500: 'IBMPlexSans-Medium',
  body600: 'IBMPlexSans-SemiBold',
  body700: 'IBMPlexSans-Bold',
  mono400: 'IBMPlexMono-Regular',
  mono500: 'IBMPlexMono-Medium',
  mono600: 'IBMPlexMono-SemiBold',
} as const;

export const typography = {
  h1: { fontSize: 22, fontFamily: fonts.display700 },
  h2: { fontSize: 18, fontFamily: fonts.display600 },
  h3: { fontSize: 16, fontFamily: fonts.display500 },
  body: { fontSize: 15, fontFamily: fonts.body400, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontFamily: fonts.body400, lineHeight: 19 },
  caption: { fontSize: 11, fontFamily: fonts.mono400 },
  // Mono eyebrow — UPPERCASE + tracked, the board's section-label pattern.
  eyebrow: { fontSize: 11, fontFamily: fonts.mono500, letterSpacing: 1.3 },
} as const;

// ── Elevation ───────────────────────────────────────────────────────────────
// The board uses NO shadows for cards — depth comes from hairline borders +
// tint. Both card presets are therefore flat (kept as exports so existing
// spreads compile; they now contribute a hairline border instead). True
// overlays (Modal/Toast) may use overlay below — the only sanctioned shadow.
export const elevation = {
  card: {
    elevation: 0,
    borderWidth: 1,
    borderColor: colors.toroBorder,
  },
  cardHigh: {
    elevation: 0,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  overlay: {
    elevation: 8,
    shadowColor: '#0A302E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
  },
} as const;
