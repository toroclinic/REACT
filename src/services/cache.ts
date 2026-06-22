// Read-side cache — implements Frontend & Backend Spec, Section 3.5.
// Every successful fetch is cached; cached data is served when offline
// with a "last updated" timestamp rather than a hard error state.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { CachedEngagementProfile, MemberProfile, RewardOffer } from '../types/api';

const KEYS = {
  engagementProfile: '@wellness/cache/engagement_profile',
  memberProfile: '@wellness/cache/member_profile',
  rewardsCatalog: '@wellness/cache/rewards_catalog',
} as const;

export async function cacheEngagementProfile(profile: CachedEngagementProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.engagementProfile, JSON.stringify(profile));
}

export async function getCachedEngagementProfile(): Promise<CachedEngagementProfile | null> {
  const raw = await AsyncStorage.getItem(KEYS.engagementProfile);
  return raw ? (JSON.parse(raw) as CachedEngagementProfile) : null;
}

export async function cacheMemberProfile(profile: MemberProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.memberProfile, JSON.stringify(profile));
}

export async function getCachedMemberProfile(): Promise<MemberProfile | null> {
  const raw = await AsyncStorage.getItem(KEYS.memberProfile);
  return raw ? (JSON.parse(raw) as MemberProfile) : null;
}

export async function cacheRewardsCatalog(catalog: RewardOffer[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.rewardsCatalog, JSON.stringify(catalog));
}

export async function getCachedRewardsCatalog(): Promise<RewardOffer[] | null> {
  const raw = await AsyncStorage.getItem(KEYS.rewardsCatalog);
  return raw ? (JSON.parse(raw) as RewardOffer[]) : null;
}

export function formatLastSynced(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Updated just now';
  if (mins < 60) return `Updated ${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}
