// Types mirror the API contracts in:
//  - USSD Pricing Module Spec, Section 3.5 (pricing module — reused as-is)
//  - Wellness+ Frontend & Backend Spec, Sections 4.2–4.5
// Keep these in lockstep with the backend OpenAPI contract. Any drift here
// is a sign the frontend has started guessing at the API shape instead of
// calling the documented one.

export type Tier = 'Starting' | 'Bronze' | 'Silver' | 'Gold';

export type EventType =
  | 'bp_screening'
  | 'glucose_screening'
  | 'activity_checkin'
  | 'medication_confirm'
  | 'spo2_reading'
  | 'sleep_log';

export type Channel = 'app' | 'ussd';

// ---- Pricing module (Section 4.3 — contract reused unchanged from USSD spec) ----

export interface EngagementEventRequest {
  member_id: string;
  event_type: EventType;
  channel: Channel;
  raw_value?: string | number | null;
  timestamp: string; // ISO 8601
}

export interface EngagementEventResponse {
  accepted: boolean;
  current_score: number;
  current_tier: Tier;
}

export interface CreditResponse {
  score: number;
  tier: Tier;
  credit_pct: number;
  effective_at_renewal_date: string; // ISO date
}

// ---- Auth service (Section 4.2) ----

export interface OtpRequestPayload {
  phone_number: string;
}

export interface OtpVerifyPayload {
  phone_number: string;
  otp: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  member_id: string;
}

// ---- Member profile service (Section 4.1) ----

export interface MemberProfile {
  member_id: string;
  full_name: string;
  policy_number: string;
  phone_number: string;
  preferred_language: 'en' | 'tn';
  renewal_date: string; // ISO date
  preferred_clinic_id: string | null;
  chronic_member: boolean;
}

// ---- Clinic confirmation service (Section 4.4) ----

export interface Clinic {
  clinic_id: string;
  name: string;
  distance_km: number;
  partner_status: 'active' | 'pending';
}

export type ScreeningStatus = 'not_logged' | 'pending_confirmation' | 'confirmed';

// ---- Rewards service (Section 4.5) ----

export interface RewardOffer {
  id: string;
  partner: string;
  offer: string;
  min_tier: Tier;
  icon: string;
  description?: string;
  value?: string;
  category?: string;
  expiry_days?: number;
}

export interface RedemptionResponse {
  redemption_code?: string;
  instore_confirmation_id?: string;
}

// ---- Activity (week view) ----

export interface ActivityWeek {
  // 7 entries, Monday-first, matches the Activity screen's week dots
  days: boolean[];
  checkins_this_cycle: number;
}

// ---- Local engagement profile (client-side cache; Section 3.3) ----
// This is what Home reads from cache to compute the task list WITHOUT a
// network call. It must be kept in sync with engagement_cycle_score server
// state on every successful event submission or credit fetch.

export interface CachedEngagementProfile {
  bp_screening_status: ScreeningStatus;
  glucose_screening_status: ScreeningStatus;
  activity_checkins_this_cycle: number;
  medication_confirmed_this_month: boolean;
  chronic_member: boolean;
  score: number;
  tier: Tier;
  credit_pct: number;
  last_synced_at: string; // ISO 8601 — drives the offline "last updated" label
}
