// Auth-related client constants. The AUTH_MODE flag (legacy OTP vs PIN) was
// removed at the auth teardown — PIN + device enrollment is the only member
// auth path now (no production members existed to migrate).

// Lock the UI behind the PIN after this long in the background (approved D2:
// the lock is client-side; the session token stays alive underneath).
//
// Raised from 2 minutes to 5, in step with the PWA. Two minutes fired on any
// ordinary app switch — answering a message, taking a call, opening the camera
// — not just on a phone being set down, so members hit a PIN prompt mid-task.
//
// Still well under ACCESS_TTL_SECONDS (15 min, backend
// services/accessToken.ts): the lock should always fire before the access token
// would need refreshing, so a returning member never faces a token-refresh edge
// case on top of a PIN prompt.
//
// Keep in sync with the PWA's copy (wellness-web/src/config/authMode.ts) — the
// two clients must not have different lock behaviour for the same member.
export const BACKGROUND_LOCK_MS = 5 * 60 * 1000;
