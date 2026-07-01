// Read-side cache — implements Frontend & Backend Spec, Section 3.5.
// Every successful fetch is cached; cached data is served when offline
// with a "last updated" timestamp rather than a hard error state.
//
// Performance layer: an in-memory store sits in front of AsyncStorage so
// that repeated reads within a session (e.g. engagement profile read on
// every screen mount) never pay disk I/O or JSON.parse after the first hit.
// Writes always flush to AsyncStorage so data survives process restarts.

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CachedEngagementProfile,
  MemberProfile,
  RewardOffer,
} from '../types/api';

const KEYS = {
  engagementProfile: '@wellness/cache/engagement_profile',
  memberProfile: '@wellness/cache/member_profile',
  rewardsCatalog: '@wellness/cache/rewards_catalog',
} as const;

// In-memory mirror — avoids AsyncStorage disk I/O + JSON.parse on hot reads.
// Invalidated on write; never used to skip the initial AsyncStorage hydration.
let _memEngagement: CachedEngagementProfile | null = null;
let _memProfile: MemberProfile | null = null;
let _memRewards: RewardOffer[] | null = null;

export async function cacheEngagementProfile(
  profile: CachedEngagementProfile,
): Promise<void> {
  _memEngagement = profile;
  await AsyncStorage.setItem(KEYS.engagementProfile, JSON.stringify(profile));
}

export async function getCachedEngagementProfile(): Promise<CachedEngagementProfile | null> {
  if (_memEngagement) {
    return _memEngagement;
  }
  const raw = await AsyncStorage.getItem(KEYS.engagementProfile);
  _memEngagement = raw ? (JSON.parse(raw) as CachedEngagementProfile) : null;
  return _memEngagement;
}

export async function cacheMemberProfile(
  profile: MemberProfile,
): Promise<void> {
  _memProfile = profile;
  await AsyncStorage.setItem(KEYS.memberProfile, JSON.stringify(profile));
}

export async function getCachedMemberProfile(): Promise<MemberProfile | null> {
  if (_memProfile) {
    return _memProfile;
  }
  const raw = await AsyncStorage.getItem(KEYS.memberProfile);
  _memProfile = raw ? (JSON.parse(raw) as MemberProfile) : null;
  return _memProfile;
}

export async function cacheRewardsCatalog(
  catalog: RewardOffer[],
): Promise<void> {
  _memRewards = catalog;
  await AsyncStorage.setItem(KEYS.rewardsCatalog, JSON.stringify(catalog));
}

export async function getCachedRewardsCatalog(): Promise<RewardOffer[] | null> {
  if (_memRewards) {
    return _memRewards;
  }
  const raw = await AsyncStorage.getItem(KEYS.rewardsCatalog);
  _memRewards = raw ? (JSON.parse(raw) as RewardOffer[]) : null;
  return _memRewards;
}

// Call on sign-out to prevent a previous member's data bleeding into the next session.
export function clearMemoryCache(): void {
  _memEngagement = null;
  _memProfile = null;
  _memRewards = null;
}

export function formatLastSynced(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) {
    return 'Updated just now';
  }
  if (mins < 60) {
    return `Updated ${mins} min ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `Updated ${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}
