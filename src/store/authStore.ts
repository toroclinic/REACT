// Lightweight auth state — only score/tier/credit/session need to be
// globally accessible per spec Section 3.1 ("avoid over-centralizing").
// Backed by AsyncStorage so a cold app launch can read the cached token
// before the auth service responds (or while offline entirely).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { AuthTokens } from '../types/api';

const ACCESS_TOKEN_KEY = '@wellness/auth/access_token';
const REFRESH_TOKEN_KEY = '@wellness/auth/refresh_token';
const MEMBER_ID_KEY = '@wellness/auth/member_id';

interface AuthState {
  memberId: string | null;
  isAuthenticated: boolean;
  hydrate: () => Promise<void>;
  setSession: (tokens: AuthTokens) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  memberId: null,
  isAuthenticated: false,

  hydrate: async () => {
    const memberId = await AsyncStorage.getItem(MEMBER_ID_KEY);
    const accessToken = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
    set({ memberId, isAuthenticated: Boolean(memberId && accessToken) });
  },

  setSession: async (tokens) => {
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, tokens.access_token],
      [REFRESH_TOKEN_KEY, tokens.refresh_token],
      [MEMBER_ID_KEY, tokens.member_id],
    ]);
    set({ memberId: tokens.member_id, isAuthenticated: true });
  },

  signOut: async () => {
    await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, MEMBER_ID_KEY]);
    set({ memberId: null, isAuthenticated: false });
  },
}));

// Plain async accessor for the API client (services/api.ts), which sits
// outside React and can't call the hook directly.
export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(ACCESS_TOKEN_KEY);
}
