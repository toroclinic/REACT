import {
  getAccessToken,
  setAccessTokenInMemory,
  useAuthStore,
  PinSession,
} from '../store/authStore';
import { getRefreshToken, setRefreshToken } from './secureStore';
import {
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
  // Parsed JSON error body, when the response had one — lets callers detect
  // structured fields like `step_up_required`/`purpose` on a 403 without
  // re-parsing the message string.
  body?: Record<string, unknown>;
  constructor(message: string, status: number, body?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

// Single-flight silent refresh: many requests can 401 at once when the 15-min
// access token expires; they all await one rotation instead of racing (which
// would trip the backend's reuse detection on the refresh token). Resolves to
// the new access token, or null if the session is gone.
let _refreshInFlight: Promise<string | null> | null = null;

async function refreshSession(): Promise<string | null> {
  if (_refreshInFlight) {
    return _refreshInFlight;
  }
  _refreshInFlight = (async () => {
    const refresh = await getRefreshToken();
    if (!refresh) {
      return null;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/auth/pin/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) {
        const bodyJson = (await res.json().catch(() => ({}))) as {
          device_revoked?: boolean;
        };
        // device_revoked (reuse detection / admin kill) → force re-enrollment.
        if (bodyJson.device_revoked) {
          await useAuthStore.getState().wipeSession();
        }
        return null;
      }
      const tokens = (await res.json()) as PinSession;
      setAccessTokenInMemory(tokens.access_token);
      await setRefreshToken(tokens.refresh_token, {
        biometric: useAuthStore.getState().biometricEnabled,
      });
      return tokens.access_token;
    } catch {
      return null;
    }
  })();
  try {
    return await _refreshInFlight;
  } finally {
    _refreshInFlight = null;
  }
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    auth?: boolean;
    headers?: Record<string, string>;
    _retried?: boolean;
  } = {},
): Promise<T> {
  const {
    method = 'GET',
    body,
    auth = true,
    headers: extraHeaders,
    _retried = false,
  } = options;

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
    if (auth && response.status === 401 && !_retried) {
      // An access token expired. Try one silent refresh, then replay the
      // original request with the fresh token. refreshSession() wipes the
      // session itself on device_revoked.
      const fresh = await refreshSession();
      if (fresh) {
        return request<T>(path, { ...options, _retried: true });
      }
      // Refresh failed but the session wasn't explicitly revoked — lock the
      // UI so the member can re-enter their PIN (which mints a new session).
      if (useAuthStore.getState().isAuthenticated) {
        useAuthStore.getState().lock();
      }
    }
    const text = await response.text().catch(() => '');
    // The API returns errors as { "error": "message" } — surface the message,
    // but keep the parsed body too (ApiError.body) so callers can read
    // structured fields like step_up_required/purpose off a 403.
    let message = text || response.statusText;
    let parsedBody: Record<string, unknown> | undefined;
    if (text) {
      try {
        const parsed = JSON.parse(text) as { error?: unknown };
        parsedBody = parsed as Record<string, unknown>;
        if (parsed && typeof parsed.error === 'string') {
          message = parsed.error;
        }
      } catch {
        // not JSON — keep the raw text
      }
    }
    throw new ApiError(message, response.status, parsedBody);
  }
  return response.json() as Promise<T>;
}

// ---- Member auth (PIN + device-bound refresh tokens) ----
// The only member auth path post auth-teardown — legacy OTP-login deleted.

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

export type StepUpPurpose = 'phone_change' | 'wallet_pay';

export const PinAuthApi = {
  // Member creation — ends by requesting an enroll-purpose OTP, so the client
  // moves straight into enrollVerify/enrollComplete below.
  register: (payload: RegisterPayload) =>
    request<{ member_id: string; sent: boolean }>('/auth/register', {
      method: 'POST',
      body: payload,
      auth: false,
    }),

  enrollStart: (phone_number: string) =>
    request<{ ok: boolean }>('/auth/enroll/start', {
      method: 'POST',
      body: { phone_number },
      auth: false,
    }),

  enrollVerify: (phone_number: string, otp: string) =>
    request<{ enrollment_ticket: string }>('/auth/enroll/verify', {
      method: 'POST',
      body: { phone_number, otp },
      auth: false,
    }),

  enrollComplete: (
    enrollment_ticket: string,
    pin: string,
    device_name: string,
  ) =>
    request<PinSession & { refresh_expires_at: string }>(
      '/auth/enroll/complete',
      {
        method: 'POST',
        body: { enrollment_ticket, pin, device_name, platform: 'android' },
        auth: false,
      },
    ),

  pinLogin: (device_id: string, pin: string) =>
    request<PinSession & { refresh_expires_at: string }>('/auth/pin/login', {
      method: 'POST',
      body: { device_id, pin },
      auth: false,
    }),

  logout: () =>
    request<{ ok: boolean }>('/auth/pin/logout', { method: 'POST' }),

  recoveryStart: (phone_number: string) =>
    request<{ ok: boolean }>('/auth/recovery/start', {
      method: 'POST',
      body: { phone_number },
      auth: false,
    }),

  recoveryVerify: (
    phone_number: string,
    otp: string,
    device_id: string,
    new_pin: string,
  ) =>
    request<PinSession & { refresh_expires_at: string }>(
      '/auth/recovery/verify',
      {
        method: 'POST',
        body: { phone_number, otp, device_id, new_pin },
        auth: false,
      },
    ),

  stepUpRequest: (purpose: StepUpPurpose) =>
    request<{ ok: boolean; sent: boolean }>('/auth/step-up/request', {
      method: 'POST',
      body: { purpose },
    }),

  stepUpVerify: (purpose: StepUpPurpose, otp: string) =>
    request<{ ok: boolean }>('/auth/step-up/verify', {
      method: 'POST',
      body: { purpose, otp },
    }),
};

// Biometric silent unlock: read the Keychain refresh token (which triggers the
// biometric prompt if enabled), rotate it for a fresh session, and unlock the
// store. Returns true on success. Used by the PIN lock screen so a returning
// member with biometrics on can resume without retyping the PIN — the server
// still verifies the token, so this is convenience over the PIN, not a bypass.
export async function attemptSilentUnlock(): Promise<boolean> {
  const refresh = await getRefreshToken('Unlock Wellness+');
  if (!refresh) {
    return false;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/auth/pin/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as {
        device_revoked?: boolean;
      };
      if (j.device_revoked) {
        await useAuthStore.getState().wipeSession();
      }
      return false;
    }
    const tokens = (await res.json()) as PinSession;
    await useAuthStore.getState().setPinSession(tokens);
    return true;
  } catch {
    return false;
  }
}

export const DevicesApi = {
  list: (memberId: string) =>
    request<{
      devices: Array<{
        device_id: string;
        device_name: string;
        platform: string;
        status: string;
        created_at: string;
        last_seen_at: string | null;
        current: boolean;
      }>;
    }>(`/member/${memberId}/devices`),
  revoke: (memberId: string, deviceId: string) =>
    request<{ ok: boolean }>(`/member/${memberId}/devices/${deviceId}`, {
      method: 'DELETE',
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
