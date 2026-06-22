// API client — implements the contracts in Wellness+ Frontend & Backend
// Spec, Sections 4.2–4.5. Points at a real gateway URL; will fail at
// runtime without a live backend, which is expected at this stage (see
// offlineQueue.ts for how writes survive that gracefully).

import { getAccessToken } from '../store/authStore';
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
  ActivityWeek,
} from '../types/api';

// Configure via env/config before shipping — see README "Backend config".
const API_BASE_URL = process.env.WELLNESS_API_BASE_URL ?? 'https://api.wellnessplus.example.bw/v1';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new ApiError(text || response.statusText, response.status);
  }
  return response.json() as Promise<T>;
}

// ---- Auth service (Section 4.2) ----

export const AuthApi = {
  requestOtp: (payload: OtpRequestPayload) =>
    request<{ sent: boolean }>('/auth/otp/request', { method: 'POST', body: payload, auth: false }),

  verifyOtp: (payload: OtpVerifyPayload) =>
    request<AuthTokens>('/auth/otp/verify', { method: 'POST', body: payload, auth: false }),
};

// ---- Pricing module (Section 4.3 — contract reused unchanged from USSD spec) ----

export const PricingApi = {
  submitEvent: (event: EngagementEventRequest) =>
    request<EngagementEventResponse>('/engagement/event', { method: 'POST', body: event }),

  getCredit: (memberId: string) =>
    request<CreditResponse>(`/engagement/${memberId}/credit`),

  getActivityWeek: (memberId: string) =>
    request<ActivityWeek>(`/engagement/${memberId}/activity-week`),
};

// ---- Member profile service ----

export const ProfileApi = {
  getProfile: (memberId: string) =>
    request<MemberProfile>(`/member/${memberId}/profile`),
};

// ---- Clinic confirmation service (Section 4.4) ----

export const ClinicApi = {
  nearby: (lat: number, lng: number) =>
    request<Clinic[]>(`/clinics/nearby?lat=${lat}&lng=${lng}`),
};

// ---- Rewards service (Section 4.5) ----

export const RewardsApi = {
  getCatalog: () => request<RewardOffer[]>('/rewards/catalog'),

  redeem: (rewardId: string, memberId: string) =>
    request<RedemptionResponse>(`/rewards/${rewardId}/redeem`, {
      method: 'POST',
      body: { member_id: memberId },
    }),
};

export { ApiError };
