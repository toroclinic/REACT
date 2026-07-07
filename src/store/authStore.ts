// Auth state — PIN + device-bound sessions, the only member auth path post
// auth-teardown (legacy OTP session deleted; no production members existed to
// migrate). Access JWT lives in memory only; refresh token in the Keychain
// (services/secureStore.ts); device_id/member_id in AsyncStorage.
//
// Lifecycle:
//   enroll / pin-login / refresh / recovery  → setPinSession()  (unlocked)
//   app backgrounded > BACKGROUND_LOCK_MS     → lock()          (session alive,
//                                                                 UI gated)
//   PIN re-entered on lock screen             → setPinSession() (unlocked)
//   member taps "Sign out"                    → signOut()       (server-side
//                                                                 logout, device
//                                                                 stays enrolled)
//   device revoked / reuse detected           → wipeSession()   (re-enroll)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { clearMemoryCache } from '../services/cache';
import {
  setRefreshToken,
  getRefreshToken,
  clearRefreshToken,
} from '../services/secureStore';

const MEMBER_ID_KEY = '@wellness/auth/member_id';
const DEVICE_ID_KEY = '@wellness/auth/device_id';
const BIOMETRIC_KEY = '@wellness/auth/biometric_enabled';

// In-memory access token — never persisted; a cold launch always starts
// LOCKED (see hydrate below) and re-derives it via PIN login or silent refresh.
let _cachedAccess: string | null | undefined;

export interface PinSession {
  access_token: string;
  refresh_token: string;
  member_id: string;
  device_id: string;
}

interface AuthState {
  memberId: string | null;
  deviceId: string | null;
  isAuthenticated: boolean; // a device is enrolled
  isLocked: boolean; // UI gated behind PIN until unlocked
  biometricEnabled: boolean;

  hydrate: () => Promise<void>;
  setPinSession: (session: PinSession) => Promise<void>;
  lock: () => void;
  setBiometricEnabled: (on: boolean) => Promise<void>;
  wipeSession: () => Promise<void>; // device revoked — forces re-enrollment
  signOut: () => void; // local half of sign-out; caller also hits pin/logout
}

export const useAuthStore = create<AuthState>(set => ({
  memberId: null,
  deviceId: null,
  isAuthenticated: false,
  isLocked: false,
  biometricEnabled: false,

  hydrate: async () => {
    const pairs = await AsyncStorage.multiGet([
      MEMBER_ID_KEY,
      DEVICE_ID_KEY,
      BIOMETRIC_KEY,
    ]);
    const memberId = pairs[0]![1];
    const deviceId = pairs[1]![1];
    const biometricEnabled = pairs[2]![1] === 'yes';

    _cachedAccess = null;
    set({
      memberId,
      deviceId,
      isAuthenticated: Boolean(deviceId && memberId),
      isLocked: Boolean(deviceId && memberId),
      biometricEnabled,
    });
  },

  setPinSession: async session => {
    _cachedAccess = session.access_token;
    const biometric = (await AsyncStorage.getItem(BIOMETRIC_KEY)) === 'yes';
    await setRefreshToken(session.refresh_token, { biometric });
    await AsyncStorage.multiSet([
      [MEMBER_ID_KEY, session.member_id],
      [DEVICE_ID_KEY, session.device_id],
    ]);
    set({
      memberId: session.member_id,
      deviceId: session.device_id,
      isAuthenticated: true,
      isLocked: false,
    });
  },

  lock: () => {
    _cachedAccess = null; // drop the in-memory access token when locking
    set({ isLocked: true });
  },

  setBiometricEnabled: async on => {
    await AsyncStorage.setItem(BIOMETRIC_KEY, on ? 'yes' : 'no');
    // Re-store the current refresh token under the new protection level.
    const token = await getRefreshToken();
    if (token) {
      await setRefreshToken(token, { biometric: on });
    }
    set({ biometricEnabled: on });
  },

  wipeSession: async () => {
    _cachedAccess = null;
    clearMemoryCache();
    await clearRefreshToken();
    await AsyncStorage.multiRemove([
      MEMBER_ID_KEY,
      DEVICE_ID_KEY,
      BIOMETRIC_KEY,
    ]);
    set({
      memberId: null,
      deviceId: null,
      isAuthenticated: false,
      isLocked: false,
      biometricEnabled: false,
    });
  },

  // Local half of sign-out: drops the in-memory access token and the (now
  // server-dead) Keychain refresh token, then locks the UI. The device stays
  // enrolled (member_id/device_id survive) — PIN login mints a fresh session,
  // no re-enrollment needed. Callers hit PinAuthApi's logout endpoint first
  // (best-effort) so the server actually revokes the session; this function
  // only does the client-side half and is deliberately synchronous so a
  // caller doesn't need to await Keychain I/O before the UI locks.
  signOut: () => {
    _cachedAccess = null;
    clearMemoryCache();
    void clearRefreshToken();
    set({ isLocked: true });
  },
}));

// Access token accessor for the API client (in-memory only).
export async function getAccessToken(): Promise<string | null> {
  return _cachedAccess ?? null;
}

/** Set the in-memory access token after a silent refresh (no store re-render). */
export function setAccessTokenInMemory(token: string): void {
  _cachedAccess = token;
}
