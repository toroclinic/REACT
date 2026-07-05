import { getAccessToken, useAuthStore } from '../store/authStore';
import {
  OtpRequestPayload,
  OtpVerifyPayload,
  AuthTokens,
  EngagementEventRequest,
  EngagementEventResponse,
  CreditResponse,
  MemberProfile,
  Clinic,
  RewardOffer,
  RedemptionResponse,
  MyRedemption,
  ActivityWeek,
  ActivityHistoryEntry,
  ScreeningResult,
  ScreeningHistoryEntry,
  Appointment,
  HealthAlert,
  MemberMessage,
  MemberReminder,
  MedicalAidScheme,
  ChronicCareVisit,
  DailyTasks,
  CoachMessage,
  WalletBalance,
  TopUpInitResponse,
  TopUpStatusResponse,
  ClinicPaymentResponse,
  WalletTransaction,
  ProfileUpdatePayload,
} from '../types/api';

// `process.env.WELLNESS_API_BASE_URL` was never wired to anything — there is
// no dotenv/babel-env plugin in this project, so it was always `undefined`
// and every build (including debug/Metro) silently hit production. `__DEV__`
// is a real RN global (true for a Metro/debug bundle, false for a release
// build) with no extra config needed. Dev points at localhost so it works
// with the same `adb reverse tcp:8081 tcp:8081` device workflow the /tecno
// skill already uses for the JS bundle — run `adb reverse tcp:4000 tcp:4000`
// to reach a locally-running backend from the device/emulator.
const API_BASE_URL = __DEV__
  ? 'http://localhost:4000/v1'
  : 'https://wellness-plus-backend.onrender.com/v1';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    auth?: boolean;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true, headers: extraHeaders } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (auth) {
    const token = await getAccessToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError('Request timed out. Please try again.', 408);
    }
    throw new ApiError(
      'No internet connection. Check your network and try again.',
      0,
    );
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    // A 401 on an authenticated request means the session is no longer valid
    // server-side — most commonly the idle-timeout auto-logout (see backend
    // authService.ts). Sign out locally so App.tsx's isAuthenticated check
    // drops straight back to LoginScreen instead of leaving the member stuck
    // on a screen that can no longer load any data.
    if (auth && response.status === 401) {
      useAuthStore
        .getState()
        .signOut()
        .catch(() => {});
    }
    const text = await response.text().catch(() => '');
    // The API returns errors as { "error": "message" } — surface just the
    // message, not the raw JSON body (matches the PWA's request()).
    let message = text || response.statusText;
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: unknown };
        if (parsed && typeof parsed.error === 'string') {
          message = parsed.error;
        }
      } catch {
        // not JSON — keep the raw text
      }
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

// ---- Auth ----

export interface RegisterPayload {
  phone_number: string;
  full_name: string;
  policy_number: string;
  renewal_date: string;
  preferred_language?: 'en' | 'tn';
  // Stage 2 — consent (terms is required by the backend at registration)
  consent_terms?: boolean;
  consent_scheme_sharing?: boolean;
  consent_channel?: 'app' | 'pwa' | 'ussd' | 'admin';
}

export const AuthApi = {
  requestOtp: (payload: OtpRequestPayload) =>
    request<{ sent: boolean }>('/auth/otp/request', {
      method: 'POST',
      body: payload,
      auth: false,
    }),

  verifyOtp: (payload: OtpVerifyPayload) =>
    request<AuthTokens>('/auth/otp/verify', {
      method: 'POST',
      body: payload,
      auth: false,
    }),

  refresh: (refreshToken: string) =>
    request<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: { refresh_token: refreshToken },
      auth: false,
    }),

  register: (payload: RegisterPayload) =>
    request<{ member_id: string; sent: boolean }>('/auth/register', {
      method: 'POST',
      body: payload,
      auth: false,
    }),
};

// ---- Engagement / pricing ----

export const PricingApi = {
  // idempotencyKey (offlineQueue's per-event localId) is forwarded as the
  // Idempotency-Key header the backend already reads (engagement.ts) — a
  // retried submission after a dropped connection then returns the original
  // event instead of double-counting a scored check-in. Mirrors the PWA's
  // submitEvent, which has sent this header since Stage 1(f).
  submitEvent: (event: EngagementEventRequest, idempotencyKey?: string) =>
    request<EngagementEventResponse>('/engagement/event', {
      method: 'POST',
      body: event,
      headers: idempotencyKey
        ? { 'Idempotency-Key': idempotencyKey }
        : undefined,
    }),

  getCredit: (memberId: string) =>
    request<CreditResponse>(`/engagement/${memberId}/credit`),

  getActivityWeek: (memberId: string) =>
    request<ActivityWeek>(`/engagement/${memberId}/activity-week`),

  getActivityHistory: (memberId: string) =>
    request<ActivityHistoryEntry[]>(`/engagement/${memberId}/activity-history`),

  getScreenings: (memberId: string) =>
    request<ScreeningResult[]>(`/engagement/${memberId}/screenings`),

  getScreeningHistory: (memberId: string) =>
    request<ScreeningHistoryEntry[]>(
      `/engagement/${memberId}/screening-history`,
    ),

  attachEvidence: async (eventId: string, formData: FormData) => {
    const token = await getAccessToken();
    const r = await fetch(
      `${API_BASE_URL}/engagement/event/${eventId}/evidence`,
      {
        method: 'PATCH',
        body: formData,
        headers: { Authorization: `Bearer ${token ?? ''}` },
      },
    );
    return r.json() as Promise<{ ok: boolean }>;
  },
};

// ---- Member profile ----

export const ProfileApi = {
  getProfile: (memberId: string) =>
    request<MemberProfile>(`/member/${memberId}/profile`),

  updateProfile: (memberId: string, payload: ProfileUpdatePayload) =>
    request<MemberProfile>(`/member/${memberId}/profile`, {
      method: 'PATCH',
      body: payload,
    }),

  updateClinic: (memberId: string, clinicId: string | null) =>
    request<{ updated: boolean; clinic_id: string | null }>(
      `/member/${memberId}/clinic`,
      { method: 'PATCH', body: { clinic_id: clinicId } },
    ),
};

// B2 — secure phone-number change (step-up policy proof + code sent to the
// new number; the old number is SMS-alerted). Mirrors the PWA's PhoneChangeApi.
export const PhoneChangeApi = {
  start: (memberId: string, newPhoneNumber: string, policyNumber: string) =>
    request<{ sent: boolean }>(`/member/${memberId}/phone-change/start`, {
      method: 'POST',
      body: { new_phone_number: newPhoneNumber, policy_number: policyNumber },
    }),

  verify: (memberId: string, code: string) =>
    request<{ changed: boolean }>(`/member/${memberId}/phone-change/verify`, {
      method: 'POST',
      body: { code },
    }),
};

// ---- Member operations ----

export const MemberApi = {
  getDailyTasks: (memberId: string) =>
    request<DailyTasks>(`/member/${memberId}/daily-tasks`),

  getAlerts: (memberId: string) =>
    request<HealthAlert[]>(`/member/${memberId}/alerts`),

  getAppointments: (memberId: string) =>
    request<Appointment[]>(`/member/${memberId}/appointments`),

  bookAppointment: (
    memberId: string,
    payload: {
      clinic_id?: string;
      location: string;
      appointment_date: string;
      appointment_time?: string;
      notes?: string;
    },
  ) =>
    request<Appointment>(`/member/${memberId}/appointments`, {
      method: 'POST',
      body: payload,
    }),

  cancelAppointment: (memberId: string, appointmentId: string) =>
    request<{ ok: boolean }>(
      `/member/${memberId}/appointments/${appointmentId}`,
      { method: 'DELETE' },
    ),
};

// ---- Clinics ----

export const ClinicApi = {
  nearby: (lat: number, lng: number) =>
    request<Clinic[]>(`/clinics/nearby?lat=${lat}&lng=${lng}`),

  // Backend route is /clinics/all, not /clinics (clinic.ts) — was 404ing
  // silently (all callers .catch(()=>[])), leaving every clinic picker empty.
  all: () => request<Clinic[]>('/clinics/all'),
};

// ---- Rewards ----

export const RewardsApi = {
  getCatalog: () => request<RewardOffer[]>('/rewards/catalog'),

  redeem: (rewardId: string, memberId: string) =>
    request<RedemptionResponse>(`/rewards/${rewardId}/redeem`, {
      method: 'POST',
      body: { member_id: memberId },
    }),

  getMyRedemptions: (memberId: string) =>
    request<MyRedemption[]>(`/rewards/my-redemptions?member_id=${memberId}`),
};

// ---- Messages ----

export const MessagesApi = {
  getMessages: (memberId: string) =>
    request<MemberMessage[]>(`/messages/${memberId}`),

  getUnreadCount: (memberId: string) =>
    request<{ count: number }>(`/messages/${memberId}/unread-count`),

  // Backend route is POST /messages/:messageId/read — no memberId segment,
  // no PATCH (messages.ts). Was 404ing (wrong method + wrong path), so the
  // unread badge never cleared.
  markRead: (messageId: string) =>
    request<{ ok: boolean }>(`/messages/${messageId}/read`, {
      method: 'POST',
    }),
};

// ---- Reminders ----

export const RemindersApi = {
  getReminders: (memberId: string) =>
    request<MemberReminder[]>(`/reminders/${memberId}`),

  // Backend route is POST /reminders/:reminderId/dismiss — no memberId
  // segment (the member is taken from the auth token, reminders.ts), no
  // PATCH. Was 404ing, so dismissed reminders kept reappearing.
  dismiss: (reminderId: string) =>
    request<{ dismissed: boolean }>(`/reminders/${reminderId}/dismiss`, {
      method: 'POST',
    }),
};

// ---- Chronic care ----

export const ChronicCareApi = {
  getVisits: (memberId: string) =>
    request<ChronicCareVisit[]>(`/chronic-care/${memberId}/visits`),
};

// ---- Coach (Tora AI) ----

export const CoachApi = {
  getHistory: (memberId: string) =>
    request<CoachMessage[]>(`/coach/${memberId}/history`),

  // Backend returns {message_id, role, content} (coach.ts) — there is no
  // `reply` field, so the assistant's answer was always rendered as blank.
  sendMessage: (memberId: string, message: string) =>
    request<{ message_id: string; role: string; content: string }>(
      `/coach/${memberId}/message`,
      { method: 'POST', body: { message } },
    ),

  clearHistory: (memberId: string) =>
    request<{ ok: boolean }>(`/coach/${memberId}/history`, {
      method: 'DELETE',
    }),
};

// ---- Medical aid schemes ----

export const SchemesApi = {
  listSchemes: () => request<MedicalAidScheme[]>('/schemes'),

  getMemberScheme: (memberId: string) =>
    request<MedicalAidScheme | null>(`/schemes/member/${memberId}`),

  updateMemberScheme: (memberId: string, schemeId: string | null) =>
    request<{ ok: boolean }>(`/schemes/member/${memberId}`, {
      method: 'PATCH',
      body: { scheme_id: schemeId },
    }),
};

// ---- Wallet ----

export const WalletApi = {
  getBalance: () => request<WalletBalance>('/wallet/balance'),

  initiateTopUp: (amount_pula: number, phone_number?: string) =>
    request<TopUpInitResponse>('/wallet/topup/initiate', {
      method: 'POST',
      body: { amount_pula, phone_number },
    }),

  pollTopUpStatus: (orderId: string) =>
    request<TopUpStatusResponse>(
      `/wallet/topup/status/${encodeURIComponent(orderId)}`,
    ),

  payClinic: (clinic_id: string, amount_pula: number) =>
    request<ClinicPaymentResponse>('/wallet/pay-clinic', {
      method: 'POST',
      body: { clinic_id, amount_pula },
    }),

  getTransactions: (limit = 20, offset = 0) =>
    request<{
      transactions: WalletTransaction[];
      limit: number;
      offset: number;
    }>(`/wallet/transactions?limit=${limit}&offset=${offset}`),
};
