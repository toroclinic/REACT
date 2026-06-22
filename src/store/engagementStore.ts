// Global engagement state — score, tier, credit, and the cached profile
// the Home screen task list is computed from. Per spec Section 3.1, this
// is intentionally one of the only pieces of truly global state, since the
// bottom tab bar and Home both depend on it staying in sync.

import { create } from 'zustand';
import { CachedEngagementProfile, EventType, Tier } from '../types/api';
import { PricingApi } from './../services/api';
import { enqueueEngagementEvent } from './../services/offlineQueue';
import {
  cacheEngagementProfile,
  getCachedEngagementProfile,
} from './../services/cache';
import { estimateScore, tierFor } from './../services/pricingMirror';

interface EngagementState {
  profile: CachedEngagementProfile | null;
  isLoading: boolean;
  isOffline: boolean;

  loadFromCache: () => Promise<void>;
  refreshFromServer: (memberId: string) => Promise<void>;
  logEvent: (memberId: string, eventType: EventType, chronicMember: boolean, rawValue?: string) => Promise<void>;
}

const FALLBACK_PROFILE: CachedEngagementProfile = {
  bp_screening_status: 'not_logged',
  glucose_screening_status: 'not_logged',
  activity_checkins_this_cycle: 0,
  medication_confirmed_this_month: false,
  chronic_member: false,
  score: 0,
  tier: 'Starting',
  credit_pct: 0,
  last_synced_at: new Date(0).toISOString(),
};

export const useEngagementStore = create<EngagementState>((set, get) => ({
  profile: null,
  isLoading: false,
  isOffline: false,

  loadFromCache: async () => {
    const cached = await getCachedEngagementProfile();
    set({ profile: cached ?? FALLBACK_PROFILE });
  },

  refreshFromServer: async (memberId: string) => {
    set({ isLoading: true });
    try {
      const credit = await PricingApi.getCredit(memberId);
      const current = get().profile ?? FALLBACK_PROFILE;
      const updated: CachedEngagementProfile = {
        ...current,
        score: credit.score,
        tier: credit.tier,
        credit_pct: credit.credit_pct,
        last_synced_at: new Date().toISOString(),
      };
      await cacheEngagementProfile(updated);
      set({ profile: updated, isOffline: false });
    } catch {
      // Offline or backend unavailable — fall back to cache silently,
      // per Section 3.5. The screen shows "last updated" rather than erroring.
      const cached = await getCachedEngagementProfile();
      set({ profile: cached ?? get().profile ?? FALLBACK_PROFILE, isOffline: true });
    } finally {
      set({ isLoading: false });
    }
  },

  // Optimistic local update + background sync, per Section 3.4: the UI
  // reflects the action immediately; the queue (services/offlineQueue.ts)
  // handles eventual consistency with the backend, including the
  // pending-confirmation badge for self-reported screenings.
  logEvent: async (memberId, eventType, chronicMember, rawValue?) => {
    const current = get().profile ?? { ...FALLBACK_PROFILE, chronic_member: chronicMember };
    const next: CachedEngagementProfile = { ...current };

    if (eventType === 'bp_screening') next.bp_screening_status = 'pending_confirmation';
    if (eventType === 'glucose_screening') next.glucose_screening_status = 'pending_confirmation';
    if (eventType === 'activity_checkin') {
      next.activity_checkins_this_cycle = Math.min(next.activity_checkins_this_cycle + 1, 4);
    }
    if (eventType === 'medication_confirm') next.medication_confirmed_this_month = true;

    // Client-side estimate only — see pricingMirror.ts header comment.
    // Re-synced with the authoritative score on the next refreshFromServer.
    const estimatedScore = estimateScore(next);
    const tier = tierFor(estimatedScore);
    next.score = estimatedScore;
    next.tier = tier.name as Tier;
    next.credit_pct = tier.creditPct;
    next.last_synced_at = new Date().toISOString();

    set({ profile: next });
    await cacheEngagementProfile(next);

    await enqueueEngagementEvent({
      member_id: memberId,
      event_type: eventType,
      channel: 'app',
      ...(rawValue != null ? { raw_value: rawValue } : {}),
    });
  },
}));
