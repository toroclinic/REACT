export type Tier = 'Starting' | 'Bronze' | 'Silver' | 'Gold';

export type EventType =
  | 'bp_screening'
  | 'glucose_screening'
  | 'cholesterol_screening'
  | 'bmi_check'
  | 'eye_screening'
  | 'dental_check'
  | 'activity_checkin'
  | 'medication_confirm'
  | 'spo2_reading'
  | 'sleep_log';

export type Channel = 'app' | 'ussd' | 'watch';
export type ScreeningStatus =
  | 'not_logged'
  | 'pending_confirmation'
  | 'confirmed';
export type MessageType = 'info' | 'alert' | 'wellness' | 'reminder';
export type ReminderUrgency = 'upcoming' | 'due' | 'urgent';
export type ChronicVisitStatus = 'due' | 'scheduled' | 'completed' | 'missed';
export type ChronicVisitUrgency = 'overdue' | 'due_soon' | 'upcoming' | null;

export interface EngagementEventRequest {
  member_id: string;
  event_type: EventType;
  channel: Channel;
  raw_value?: string | number | null;
  timestamp: string;
}

export interface EngagementEventResponse {
  accepted: boolean;
  current_score: number;
  current_tier: Tier;
  event_id?: string;
}

export interface ScoreBreakdownItem {
  category: string;
  earned: number;
  max: number;
  done: boolean;
}

// Numeric pricing parameters of the member's medical aid scheme — lets the
// client-side pricing mirror estimate with the member's actual scheme
// instead of Toro defaults. Served by GET /engagement/:id/credit.
export interface SchemePricingConfig {
  bp_points: number;
  glucose_points: number;
  activity_points: number;
  max_activity_checkins: number;
  chronic_bonus: number;
  bronze_threshold: number;
  silver_threshold: number;
  gold_threshold: number;
  bronze_credit_pct: number;
  silver_credit_pct: number;
  gold_credit_pct: number;
}

export interface CreditResponse {
  score: number;
  tier: Tier;
  credit_pct: number;
  effective_at_renewal_date: string;
  bp_screening_done: boolean;
  glucose_screening_done: boolean;
  scheme_id?: string;
  scheme_name?: string;
  scheme_color?: string;
  breakdown?: ScoreBreakdownItem[];
  next_tier?: Tier | null;
  points_to_next_tier?: number;
  scheme_config?: SchemePricingConfig;
}

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

export interface MemberProfile {
  member_id: string;
  full_name: string;
  policy_number: string;
  phone_number: string;
  preferred_language: 'en' | 'tn';
  renewal_date: string;
  preferred_clinic_id: string | null;
  chronic_member: boolean;
  date_of_birth?: string | null;
  gender?: string;
  national_id?: string | null;
  marital_status?: string;
  address?: string | null;
  annual_premium_bwp?: number;
  scheme_id?: string | null;
}

export interface ProfileUpdatePayload {
  full_name?: string;
  date_of_birth?: string;
  gender?: string;
  marital_status?: string;
  address?: string;
  preferred_language?: 'en' | 'tn';
}

export interface Clinic {
  clinic_id: string;
  name: string;
  distance_km: number;
  partner_status: 'active' | 'pending';
  lat?: number;
  lng?: number;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  opening_hours?: string | null;
  services?: string | null;
}

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
  active?: number;
}

export interface RedemptionResponse {
  redemption_code?: string;
  instore_confirmation_id?: string;
}

export interface MyRedemption {
  redemption_id: string;
  offer_id: string;
  partner: string;
  offer: string;
  redeemed_at: string;
  expires_at: string | null;
  redemption_code: string | null;
}

export interface ActivityWeek {
  days: boolean[];
  checkins_this_cycle: number;
}

export interface ActivityHistoryEntry {
  date: string;
  count: number;
  minutes: number;
}

export interface ScreeningResult {
  type: EventType;
  status: ScreeningStatus;
  logged_at: string | null;
  test_date: string | null;
  result: string | null;
  confirmed_at: string | null;
}

export interface ScreeningHistoryEntry {
  event_id: string;
  event_type: EventType;
  logged_at: string;
  result: string | null;
  status: ScreeningStatus;
  clinic_name: string | null;
}

export interface Appointment {
  appointment_id: string;
  member_id: string;
  clinic_id: string | null;
  location: string;
  appointment_date: string;
  appointment_time: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

export interface HealthAlert {
  alert_id: string;
  parameter: string;
  value_text: string | null;
  severity: 'critical' | 'abnormal' | 'normal';
  detail: string | null;
  created_at: string;
}

export interface MemberMessage {
  message_id: string;
  subject: string;
  body: string;
  type: MessageType;
  read: boolean;
  created_at: string;
}

export interface MemberReminder {
  reminder_id: string;
  condition: string;
  type: string;
  title: string;
  message: string;
  due_date: string;
  urgency: ReminderUrgency;
  created_at: string;
}

export interface MedicalAidScheme {
  scheme_id: string;
  name: string;
  short_name: string;
  color: string;
  logo_initials: string;
  gold_threshold: number;
  gold_credit_pct: number;
  active: number;
}

export interface ChronicCareVisit {
  visit_id: string;
  member_id: string;
  condition: string;
  condition_label: string;
  due_date: string;
  status: ChronicVisitStatus;
  urgency: ChronicVisitUrgency;
  appointment_id: string | null;
  clinic_id: string | null;
  confirmed_at: string | null;
  medication_adherent: number;
  labs_done: number;
  notes: string | null;
  expected_labs: string[];
}

export interface DailyTasks {
  medication: boolean;
  blood_pressure: boolean;
  activity: boolean;
  water: boolean;
}

export interface CoachMessage {
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export type WalletTxnType =
  | 'topup'
  | 'clinic_payment'
  | 'wellness_credit'
  | 'employer_credit';
export type WalletTxnDirection = 'credit' | 'debit';
export type WalletTxnStatus = 'pending' | 'completed' | 'failed';

export interface WalletTransaction {
  txn_id: string;
  wallet_id: string;
  member_id: string;
  type: WalletTxnType;
  direction: WalletTxnDirection;
  amount_pula: number;
  status: WalletTxnStatus;
  idempotency_key: string | null;
  om_txn_id: string | null;
  om_order_id: string | null;
  clinic_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WalletBalance {
  wallet_id: string;
  balance_pula: number;
  lifetime_credited_pula: number;
  lifetime_paid_pula: number;
  last_activity_at: string | null;
  recent_transactions: WalletTransaction[];
}

export interface TopUpInitResponse {
  payment_url: string;
  payment_token: string;
  order_id: string;
  session_id: string;
  txn_id: string;
}

export interface TopUpStatusResponse {
  status: WalletTxnStatus;
  amount_pula: number;
  new_balance?: number;
}

export interface ClinicPaymentResponse {
  success: boolean;
  txn_id: string;
  new_balance_pula: number;
  clinic_name: string;
}

export interface CachedEngagementProfile {
  bp_screening_status: ScreeningStatus;
  glucose_screening_status: ScreeningStatus;
  activity_checkins_this_cycle: number;
  medication_confirmed_this_month: boolean;
  chronic_member: boolean;
  score: number;
  tier: Tier;
  credit_pct: number;
  last_synced_at: string;
  annual_premium_bwp?: number | null;
  scheme_id?: string;
  scheme_name?: string;
  scheme_color?: string;
  breakdown?: ScoreBreakdownItem[];
  next_tier?: Tier | null;
  points_to_next_tier?: number;
  scheme_config?: SchemePricingConfig;
}
