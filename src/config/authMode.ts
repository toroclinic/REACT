// Auth-related client constants. The AUTH_MODE flag (legacy OTP vs PIN) was
// removed at the auth teardown — PIN + device enrollment is the only member
// auth path now (no production members existed to migrate).

// Lock the UI behind the PIN after this long in the background (approved D2:
// the lock is client-side; the session token stays alive underneath).
export const BACKGROUND_LOCK_MS = 2 * 60 * 1000;
