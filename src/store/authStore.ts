// Auth state — supports BOTH the legacy OTP session (opaque tokens in
// AsyncStorage) and the new device/PIN model (access JWT in memory, refresh
// token in the Keychain, device_id/member_id in AsyncStorage). Which one is
// live is governed by config/authMode.ts; both coexist during the migration.
//
// New-model lifecycle:
//   enroll / pin-login / refresh / recovery  → setPinSession()  (unlocked)
//   app backgrounded > BACKGROUND_LOCK_MS     → lock()          (session alive,
//                                                                 UI gated)
//   PIN re-entered on lock screen             → setPinSession() (unlocked)
//   device revoked / reuse detected           → wipeSession()   (re-enroll)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { AuthTokens } from '../types/api';
import { clearMemoryCache } from '../services/cache';
import {
  setRefreshToken,
  getRefreshToken,
  clearRefreshToken,
} from '../services/secureStore';

const ACCESS_TOKEN_KEY = '@wellness/auth/access_token'; // legacy only
const REFRESH_TOKEN_KEY = '@wellness/auth/refresh_token'; // legacy only
const MEMBER_ID_KEY = '@wellness/auth/member_id';
const DEVICE_ID_KEY = '@wellness/auth/device_id';
const BIOMETRIC_KEY = '@wellness/auth/biometric_enabled';

// In-memory access token (new model keeps it off disk entirely; legacy also
// caches it here to avoid a disk read per request).
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
  isAuthenticated: boolean; // has a usable session (legacy) or enrolled device
  isLocked: boolean; // new model: UI gated behind PIN until unlocked
  biometricEnabled: boolean;

  hydrate: () => Promise<void>;
  setSession: (tokens: AuthTokens) => Promise<void>; // legacy path
  setPinSession: (session: PinSession) => Promise<void>; // new model
  lock: () => void;
  setBiometricEnabled: (on: boolean) => Promise<void>;
  wipeSession: () => Promise<void>; // device revoked
  signOut: () => Promise<void>;
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
      ACCESS_TOKEN_KEY,
      DEVICE_ID_KEY,
      BIOMETRIC_KEY,
    ]);
    const memberId = pairs[0]![1];
    const legacyAccess = pairs[1]![1];
    const deviceId = pairs[2]![1];
    const biometricEnabled = pairs[3]![1] === 'yes';

    if (deviceId && memberId) {
      // New model: a device is enrolled. The access token is never persisted,
      // so a cold launch always starts LOCKED — the lock screen unlocks via
      // PIN login or (biometric) silent refresh.
      _cachedAccess = null;
      set({
        memberId,
        deviceId,
        isAuthenticated: true,
        isLocked: true,
        biometricEnabled,
      });
      return;
    }
    // Legacy session.
    _cachedAccess = legacyAccess ?? null;
    set({
      memberId,
      deviceId: null,
      isAuthenticated: Boolean(memberId && legacyAccess),
      isLocked: false,
      biometricEnabled: false,
    });
  },

  setSession: async tokens => {
    _cachedAccess = tokens.access_token;
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, tokens.access_token],
      [REFRESH_TOKEN_KEY, tokens.refresh_token],
      [MEMBER_ID_KEY, tokens.member_id],
    ]);
    set({ memberId: tokens.member_id, isAuthenticated: true, isLocked: false });
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
      ACCESS_TOKEN_KEY,
      REFRESH_TOKEN_KEY,
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

  signOut: async () => {
    // Same local teardown as wipeSession; kept as a distinct name because the
    // API layer calls signOut() on legacy 401s.
    _cachedAccess = null;
    clearMemoryCache();
    await clearRefreshToken();
    await AsyncStorage.multiRemove([
      ACCESS_TOKEN_KEY,
      REFRESH_TOKEN_KEY,
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
}));

// Access token accessor for the API client (in-memory only for the new model).
export async function getAccessToken(): Promise<string | null> {
  if (_cachedAccess !== undefined) {
    return _cachedAccess;
  }
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY); // legacy cold start
  _cachedAccess = token;
  return token;
}

/** Set the in-memory access token after a silent refresh (no store re-render). */
export function setAccessTokenInMemory(token: string): void {
  _cachedAccess = token;
}
