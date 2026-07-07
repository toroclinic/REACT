// Secure storage for the device-bound refresh token — auth migration Phase 3.
//
// The refresh token is the long-lived (60-day) credential, so unlike the old
// AsyncStorage approach (plaintext in app-private storage) it lives in the
// Android Keystore / iOS Keychain via react-native-keychain. Optionally its
// release is gated behind a biometric prompt (accessControl), which is how the
// "biometric unlock" convenience is implemented: biometrics don't replace the
// server-side PIN check — they gate local access to the stored refresh token so
// a returning member can resume without retyping their PIN. The server still
// verifies the PIN for any fresh token issuance (enroll / pin-login / recovery).
//
// device_id and member_id are NOT secrets (a device_id is useless without the
// refresh token or PIN), so they stay in AsyncStorage for cheap synchronous-ish
// reads; only the refresh token gets the Keychain round-trip.

import * as Keychain from 'react-native-keychain';

const REFRESH_SERVICE = 'com.wellnessplus.refresh';
// A fixed username slot — Keychain stores a username/password pair; we only use
// the password field for the token.
const REFRESH_ACCOUNT = 'refresh_token';

export interface StoreRefreshOptions {
  /** Require a biometric/device-credential prompt to read the token back. */
  biometric?: boolean;
}

export async function setRefreshToken(
  token: string,
  opts: StoreRefreshOptions = {},
): Promise<void> {
  const options: Keychain.Options = {
    service: REFRESH_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  };
  if (opts.biometric) {
    options.accessControl =
      Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET_OR_DEVICE_PASSCODE;
  }
  await Keychain.setGenericPassword(REFRESH_ACCOUNT, token, options);
}

/**
 * Read the refresh token. If it was stored with biometric protection this
 * triggers the OS prompt. Returns null when absent or when the user cancels /
 * fails the biometric check (caller then falls back to PIN login).
 */
export async function getRefreshToken(
  promptTitle = 'Unlock Wellness+',
): Promise<string | null> {
  try {
    const result = await Keychain.getGenericPassword({
      service: REFRESH_SERVICE,
      authenticationPrompt: { title: promptTitle },
    });
    return result ? result.password : null;
  } catch {
    // User cancelled biometrics, no hardware, or key invalidated by a biometric
    // enrolment change — treat as "no token available", fall back to PIN.
    return null;
  }
}

export async function clearRefreshToken(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: REFRESH_SERVICE });
  } catch {
    // Nothing stored — nothing to clear.
  }
}

/** Best-effort check for available biometric hardware (to show the toggle). */
export async function biometricType(): Promise<Keychain.BIOMETRY_TYPE | null> {
  try {
    return await Keychain.getSupportedBiometryType();
  } catch {
    return null;
  }
}
