// Client-side mirror of the pricing module scoring function.
//
// IMPORTANT — read before editing:
// This function exists ONLY to compute the Home screen's task list
// (Section 3.3 of the Frontend & Backend Spec) without an extra network
// round trip. It must produce IDENTICAL results to the backend pricing
// module's scoring function (USSD Pricing Module Spec, Section 2.3).
//
// The backend score (from GET /v1/engagement/{member_id}/credit) is always
// the source of truth and is what's actually displayed on the pula card.
// This function is a presentation-layer convenience for "what should the
// member do next" — never used to compute or display the credit itself.
//
// Scheme-aware (2026-07-02): the backend is scheme-aware ("v2-scheme-aware"
// calculation version) — each medical aid partner has its own point values,
// thresholds and credit percentages. The member's scheme config is cached on
// the engagement profile (profile.scheme_config, served by /credit); when
// absent (older cache, first launch) the Toro defaults below apply.

import {
  CachedEngagementProfile,
  SchemePricingConfig,
  Tier,
} from '../types/api';

export interface TierInfo {
  name: Tier;
  creditPct: number;
}

// Mirrors DEFAULT_SCHEME in the backend's pricingModule.ts.
export const TORO_DEFAULT_SCHEME: SchemePricingConfig = {
  bp_points: 25,
  glucose_points: 25,
  activity_points: 8.75,
  max_activity_checkins: 4,
  chronic_bonus: 15,
  bronze_threshold: 25,
  silver_threshold: 50,
  gold_threshold: 75,
  bronze_credit_pct: 3,
  silver_credit_pct: 6,
  gold_credit_pct: 10,
};

export function tierFor(score: number, scheme?: SchemePricingConfig): TierInfo {
  const s = scheme ?? TORO_DEFAULT_SCHEME;
  if (score >= s.gold_threshold) {
    return { name: 'Gold', creditPct: s.gold_credit_pct };
  }
  if (score >= s.silver_threshold) {
    return { name: 'Silver', creditPct: s.silver_credit_pct };
  }
  if (score >= s.bronze_threshold) {
    return { name: 'Bronze', creditPct: s.bronze_credit_pct };
  }
  return { name: 'Starting', creditPct: 0 };
}

export function estimateScore(
  profile: Pick<
    CachedEngagementProfile,
    | 'bp_screening_status'
    | 'glucose_screening_status'
    | 'activity_checkins_this_cycle'
    | 'medication_confirmed_this_month'
    | 'chronic_member'
    | 'scheme_config'
  >,
): number {
  const s = profile.scheme_config ?? TORO_DEFAULT_SCHEME;
  let score = 0;
  // Pending-confirmation counts toward the task-list display (so the member
  // sees the task as in-progress, not missing) but the backend is the only
  // source of truth for whether it has actually been confirmed and credited.
  if (profile.bp_screening_status !== 'not_logged') {
    score += s.bp_points;
  }
  if (profile.glucose_screening_status !== 'not_logged') {
    score += s.glucose_points;
  }
  score +=
    Math.min(profile.activity_checkins_this_cycle, s.max_activity_checkins) *
    s.activity_points;
  if (profile.chronic_member && profile.medication_confirmed_this_month) {
    score += s.chronic_bonus;
  }
  return Math.min(Math.round(score), 100);
}

export interface TaskItem {
  id: string;
  icon: string;
  label: string;
  points: string;
  target: 'Screening' | 'Activity';
}

// Points can be fractional (e.g. 8.75) — trim trailing zeros for display.
function fmtPts(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

// Drives the dynamic task list on Home. Order matters: screenings first
// (highest point value, builds trust fastest), then activity.
export function computeTasks(profile: CachedEngagementProfile): TaskItem[] {
  const s = profile.scheme_config ?? TORO_DEFAULT_SCHEME;
  const tasks: TaskItem[] = [];

  if (profile.bp_screening_status === 'not_logged') {
    tasks.push({
      id: 'bp',
      icon: 'ti-heart-rate-monitor',
      label: 'Complete a blood pressure screening',
      points: `+${fmtPts(s.bp_points)} pts`,
      target: 'Screening',
    });
  }
  if (profile.glucose_screening_status === 'not_logged') {
    tasks.push({
      id: 'glucose',
      icon: 'ti-droplet-half-2',
      label: 'Complete a glucose screening',
      points: `+${fmtPts(s.glucose_points)} pts`,
      target: 'Screening',
    });
  }
  if (profile.activity_checkins_this_cycle < s.max_activity_checkins) {
    tasks.push({
      id: 'activity',
      icon: 'ti-walk',
      label: `Log activity (${profile.activity_checkins_this_cycle}/${s.max_activity_checkins} this cycle)`,
      points: `+${fmtPts(s.activity_points)} pts each`,
      target: 'Activity',
    });
  }
  if (profile.chronic_member && !profile.medication_confirmed_this_month) {
    tasks.push({
      id: 'medication',
      icon: 'ti-pill',
      label: 'Confirm medication adherence this month',
      points: `+${fmtPts(s.chronic_bonus)} pts`,
      target: 'Activity',
    });
  }

  return tasks;
}
