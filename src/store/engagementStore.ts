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
  logEvent: (
    memberId: string,
    eventType: EventType,
    chronicMember: boolean,
    rawValue?: string,
  ) => Promise<void>;
  applyOptimisticUpdate: (
    patch: Partial<CachedEngagementProfile>,
  ) => Promise<void>;
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
        bp_screening_status: credit.bp_screening_done
          ? 'confirmed'
          : current.bp_screening_status,
        glucose_screening_status: credit.glucose_screening_done
          ? 'confirmed'
          : current.glucose_screening_status,
        scheme_id: credit.scheme_id,
        scheme_name: credit.scheme_name,
        scheme_color: credit.scheme_color,
        breakdown: credit.breakdown,
        next_tier: credit.next_tier,
        points_to_next_tier: credit.points_to_next_tier,
        last_synced_at: new Date().toISOString(),
      };
      await cacheEngagementProfile(updated);
      // Single set() = single reconciliation pass across all subscribers
      set({ profile: updated, isOffline: false, isLoading: false });
    } catch {
      const cached = await getCachedEngagementProfile();
      set({
        profile: cached ?? get().profile ?? FALLBACK_PROFILE,
        isOffline: true,
        isLoading: false,
      });
    }
  },

  logEvent: async (memberId, eventType, chronicMember, rawValue?) => {
    const current = get().profile ?? {
      ...FALLBACK_PROFILE,
      chronic_member: chronicMember,
    };
    const next: CachedEngagementProfile = { ...current };

    if (eventType === 'bp_screening') {
      next.bp_screening_status = 'pending_confirmation';
    }
    if (eventType === 'glucose_screening') {
      next.glucose_screening_status = 'pending_confirmation';
    }
    if (eventType === 'activity_checkin') {
      next.activity_checkins_this_cycle = Math.min(
        next.activity_checkins_this_cycle + 1,
        4,
      );
    }
    if (eventType === 'medication_confirm') {
      next.medication_confirmed_this_month = true;
    }

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

  applyOptimisticUpdate: async patch => {
    const current = get().profile ?? FALLBACK_PROFILE;
    const next: CachedEngagementProfile = {
      ...current,
      ...patch,
      last_synced_at: new Date().toISOString(),
    };
    set({ profile: next });
    await cacheEngagementProfile(next);
  },
}));
