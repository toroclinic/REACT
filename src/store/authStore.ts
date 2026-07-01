// Lightweight auth state — only score/tier/credit/session need to be
// globally accessible per spec Section 3.1 ("avoid over-centralizing").
// Backed by AsyncStorage so a cold app launch can read the cached token
// before the auth service responds (or while offline entirely).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { AuthTokens } from '../types/api';
import { clearMemoryCache } from '../services/cache';

const ACCESS_TOKEN_KEY = '@wellness/auth/access_token';
const REFRESH_TOKEN_KEY = '@wellness/auth/refresh_token';
const MEMBER_ID_KEY = '@wellness/auth/member_id';

// Module-level token cache — eliminates an AsyncStorage disk read on every
// authenticated request. Undefined = cache not yet seeded (hydrate not run).
let _cachedToken: string | null | undefined;

interface AuthState {
  memberId: string | null;
  isAuthenticated: boolean;
  hydrate: () => Promise<void>;
  setSession: (tokens: AuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(set => ({
  memberId: null,
  isAuthenticated: false,

  hydrate: async () => {
    // Single multiGet round-trip instead of two sequential getItem calls.
    // multiGet always returns one entry per requested key, in order, but
    // TS's noUncheckedIndexedAccess can't express that guarantee — hence
    // the non-null assertions rather than array destructuring.
    const pairs = await AsyncStorage.multiGet([
      MEMBER_ID_KEY,
      ACCESS_TOKEN_KEY,
    ]);
    const memberId = pairs[0]![1];
    const accessToken = pairs[1]![1];
    _cachedToken = accessToken ?? null;
    set({ memberId, isAuthenticated: Boolean(memberId && accessToken) });
  },

  setSession: async tokens => {
    _cachedToken = tokens.access_token;
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, tokens.access_token],
      [REFRESH_TOKEN_KEY, tokens.refresh_token],
      [MEMBER_ID_KEY, tokens.member_id],
    ]);
    set({ memberId: tokens.member_id, isAuthenticated: true });
  },

  signOut: async () => {
    _cachedToken = null;
    clearMemoryCache();
    await AsyncStorage.multiRemove([
      ACCESS_TOKEN_KEY,
      REFRESH_TOKEN_KEY,
      MEMBER_ID_KEY,
    ]);
    set({ memberId: null, isAuthenticated: false });
  },
}));

// Plain accessor for the API client — returns the in-memory cached token
// when available (zero disk I/O), falls back to AsyncStorage on first call
// before hydrate() has run (e.g. deep-link cold start).
export async function getAccessToken(): Promise<string | null> {
  if (_cachedToken !== undefined) {
    return _cachedToken;
  }
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  _cachedToken = token;
  return token;
}
