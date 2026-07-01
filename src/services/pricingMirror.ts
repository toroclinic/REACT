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
// score = min(100,
//   (bp_screening_done ? 25 : 0) +
//   (glucose_screening_done ? 25 : 0) +
//   (min(activity_checkins, 4) * 8.75) +
//   (chronic_member AND medication_confirmed_this_month ? 15 : 0)
// )

import { CachedEngagementProfile, Tier } from '../types/api';

export interface TierInfo {
  name: Tier;
  creditPct: number;
}

export function tierFor(score: number): TierInfo {
  if (score >= 75) {
    return { name: 'Gold', creditPct: 10 };
  }
  if (score >= 50) {
    return { name: 'Silver', creditPct: 6 };
  }
  if (score >= 25) {
    return { name: 'Bronze', creditPct: 3 };
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
  >,
): number {
  let score = 0;
  // Pending-confirmation counts toward the task-list display (so the member
  // sees the task as in-progress, not missing) but the backend is the only
  // source of truth for whether it has actually been confirmed and credited.
  if (profile.bp_screening_status !== 'not_logged') {
    score += 25;
  }
  if (profile.glucose_screening_status !== 'not_logged') {
    score += 25;
  }
  score += Math.min(profile.activity_checkins_this_cycle, 4) * 8.75;
  if (profile.chronic_member && profile.medication_confirmed_this_month) {
    score += 15;
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

// Drives the dynamic task list on Home. Order matters: screenings first
// (highest point value, builds trust fastest), then activity.
export function computeTasks(profile: CachedEngagementProfile): TaskItem[] {
  const tasks: TaskItem[] = [];

  if (profile.bp_screening_status === 'not_logged') {
    tasks.push({
      id: 'bp',
      icon: 'ti-heart-rate-monitor',
      label: 'Complete a blood pressure screening',
      points: '+25 pts',
      target: 'Screening',
    });
  }
  if (profile.glucose_screening_status === 'not_logged') {
    tasks.push({
      id: 'glucose',
      icon: 'ti-droplet-half-2',
      label: 'Complete a glucose screening',
      points: '+25 pts',
      target: 'Screening',
    });
  }
  if (profile.activity_checkins_this_cycle < 4) {
    tasks.push({
      id: 'activity',
      icon: 'ti-walk',
      label: `Log activity (${profile.activity_checkins_this_cycle}/4 this cycle)`,
      points: '+8.75 pts each',
      target: 'Activity',
    });
  }
  if (profile.chronic_member && !profile.medication_confirmed_this_month) {
    tasks.push({
      id: 'medication',
      icon: 'ti-pill',
      label: 'Confirm medication adherence this month',
      points: '+15 pts',
      target: 'Activity',
    });
  }

  return tasks;
}
