// Client-side auth feature flag — auth migration Phase 3.
// Mirrors the backend AUTH_PIN_MODE. RN has no env plumbing (only __DEV__), so
// this is a build-time constant flipped by hand at cutover:
//   'legacy' — OTP-at-every-login only (pre-migration behaviour)
//   'pin'    — PIN + device enrollment (the new model)
// Kept as a single switch so the old LoginScreen path stays reachable behind it
// until Phase 5 retires it.
export const AUTH_MODE: 'legacy' | 'pin' = 'pin';

// Lock the UI behind the PIN after this long in the background (approved D2:
// the lock is client-side; the session token stays alive underneath).
export const BACKGROUND_LOCK_MS = 2 * 60 * 1000;
