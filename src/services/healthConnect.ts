// Watch sync service — Android uses Health Connect (Wear OS / Galaxy Watch /
// Fitbit / Garmin), iOS uses HealthKit (Apple Watch). Both platforms read
// workout sessions from the past 7 days, skip sessions under 15 minutes, and
// submit them as activity_checkin events. AsyncStorage deduplication prevents
// double-counting if the user syncs multiple times.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PricingApi } from './api';

const SYNCED_IDS_KEY = 'wellness:watch:synced_ids_v1';
const MIN_DURATION_MINUTES = 15;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// ── Shared helpers ────────────────────────────────────────────────────────────

function durationMinutes(startTime: string, endTime: string): number {
  return Math.round(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000,
  );
}

async function getSyncedSet(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(SYNCED_IDS_KEY);
  return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
}

async function saveSyncedSet(synced: Set<string>): Promise<void> {
  await AsyncStorage.setItem(SYNCED_IDS_KEY, JSON.stringify([...synced]));
}

// ── Android — Health Connect ──────────────────────────────────────────────────

const HC_EXERCISE_TYPE_MAP: Record<number, string> = {
  8:  'cycling',  21: 'cycling',
  24: 'dancing',
  31: 'football',
  39: 'hiking',
  46: 'jump_rope',
  54: 'pilates',
  62: 'running',  63: 'running',
  74: 'walking',  85: 'walking',
  76: 'gym',      87: 'gym',
  80: 'swimming', 79: 'swimming',
  89: 'yoga',
  48: 'gym',
  38: 'gym',
};

function hcActivityType(exerciseType: number): string {
  return HC_EXERCISE_TYPE_MAP[exerciseType] ?? 'other';
}

async function isHealthConnectAvailableAndroid(): Promise<boolean> {
  try {
    const {
      getSdkStatus,
      SdkAvailabilityStatus,
    } = await import('react-native-health-connect');
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

const REQUIRED_HC_PERMISSIONS: Array<{ accessType: 'read'; recordType: string }> = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'OxygenSaturation' },
  { accessType: 'read', recordType: 'SleepSession' },
];

async function syncAndroid(memberId: string): Promise<number> {
  const {
    initialize,
    requestPermission,
    getGrantedPermissions,
    readRecords,
  } = await import('react-native-health-connect');

  await initialize();

  const existing = await getGrantedPermissions();
  const grantedSet = new Set(
    existing.filter((p: any) => p.accessType === 'read').map((p: any) => p.recordType),
  );
  const missing = REQUIRED_HC_PERMISSIONS.filter(p => !grantedSet.has(p.recordType));
  if (missing.length > 0) {
    const result = await requestPermission(missing);
    const anyDenied = missing.some(
      p => !result.some((r: any) => r.recordType === p.recordType && r.accessType === 'read'),
    );
    if (anyDenied && !grantedSet.has('ExerciseSession')) throw new Error('permission_denied');
  }

  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: new Date(Date.now() - SEVEN_DAYS_MS).toISOString(),
    endTime: new Date().toISOString(),
  };

  // react-native-health-connect 3.x: readRecords returns { records: T[] }
  const [exerciseResult, spo2Result, sleepResult] = await Promise.all([
    readRecords('ExerciseSession', { timeRangeFilter }),
    readRecords('OxygenSaturation', { timeRangeFilter }),
    readRecords('SleepSession', { timeRangeFilter }),
  ]);

  const exerciseSessions = (exerciseResult as any).records ?? exerciseResult ?? [];
  const spo2Records = (spo2Result as any).records ?? spo2Result ?? [];
  const sleepSessions = (sleepResult as any).records ?? sleepResult ?? [];

  const synced = await getSyncedSet();
  let submitted = 0;

  // ── Exercise sessions ────────────────────────────────────────────────
  for (const session of exerciseSessions) {
    const id = session.metadata?.id ?? '';
    if (!id || synced.has(id)) continue;
    const duration = durationMinutes(session.startTime, session.endTime);
    if (duration < MIN_DURATION_MINUTES) continue;
    try {
      await PricingApi.submitEvent({
        member_id: memberId,
        event_type: 'activity_checkin',
        channel: 'app',
        timestamp: session.startTime,
        metadata: {
          activity_type: hcActivityType(session.exerciseType ?? 0),
          duration_minutes: duration,
          source: 'health_connect',
        },
      });
      synced.add(id);
      submitted++;
    } catch { /* retry next sync */ }
  }

  // ── SpO2 — lowest per day ────────────────────────────────────────────
  const spo2ByDay = new Map<string, { id: string; pct: number; time: string }>();
  for (const rec of spo2Records) {
    const id = rec.metadata?.id ?? '';
    if (!id || synced.has(id)) continue;
    const day = (rec.time as string).slice(0, 10);
    // HC 3.x: percentage is { value: number } object
    const pct = rec.percentage?.value ?? rec.percentage ?? 0;
    const existing = spo2ByDay.get(day);
    if (!existing || pct < existing.pct) spo2ByDay.set(day, { id, pct, time: rec.time });
  }
  for (const { id, pct, time } of spo2ByDay.values()) {
    try {
      await PricingApi.submitEvent({
        member_id: memberId,
        event_type: 'spo2_reading',
        channel: 'app',
        timestamp: time,
        raw_value: JSON.stringify({ result: `${pct.toFixed(1)}%`, source: 'health_connect' }),
      });
      synced.add(id);
      submitted++;
    } catch { /* retry next sync */ }
  }

  // ── Sleep sessions ───────────────────────────────────────────────────
  for (const session of sleepSessions) {
    const id = session.metadata?.id ?? '';
    if (!id || synced.has(id)) continue;
    const hrs = durationMinutes(session.startTime, session.endTime) / 60;
    if (hrs < 0.5) continue;
    try {
      await PricingApi.submitEvent({
        member_id: memberId,
        event_type: 'sleep_log',
        channel: 'app',
        timestamp: session.startTime,
        raw_value: JSON.stringify({ result: `${hrs.toFixed(1)}h`, source: 'health_connect' }),
      });
      synced.add(id);
      submitted++;
    } catch { /* retry next sync */ }
  }

  await saveSyncedSet(synced);
  return submitted;
}

// ── iOS — HealthKit (react-native-health 1.x) ─────────────────────────────────

const HK_ACTIVITY_TYPE_MAP: Record<string, string> = {
  HKWorkoutActivityTypeCycling:            'cycling',
  HKWorkoutActivityTypeRunning:            'running',
  HKWorkoutActivityTypeWalking:            'walking',
  HKWorkoutActivityTypeSwimming:           'swimming',
  HKWorkoutActivityTypeSwimmingStyle:      'swimming',
  HKWorkoutActivityTypeYoga:               'yoga',
  HKWorkoutActivityTypePilates:            'pilates',
  HKWorkoutActivityTypeDancing:            'dancing',
  HKWorkoutActivityTypeHiking:             'hiking',
  HKWorkoutActivityTypeJumpRope:           'jump_rope',
  HKWorkoutActivityTypeTraditionalStrengthTraining: 'gym',
  HKWorkoutActivityTypeFunctionalStrengthTraining:  'gym',
  HKWorkoutActivityTypeHighIntensityIntervalTraining: 'gym',
  HKWorkoutActivityTypeMartialArts:        'gym',
  HKWorkoutActivityTypeAmericanFootball:   'football',
  HKWorkoutActivityTypeSoccer:             'football',
};

function hkActivityType(workoutType: string): string {
  return HK_ACTIVITY_TYPE_MAP[workoutType] ?? 'other';
}

async function syncIos(memberId: string): Promise<number> {
  const AppleHealthKit = (await import('react-native-health')).default;

  const permissions = {
    permissions: {
      read: [
        AppleHealthKit.Constants.Permissions.Workout,
        AppleHealthKit.Constants.Permissions.OxygenSaturation,
        AppleHealthKit.Constants.Permissions.SleepAnalysis,
      ],
      write: [] as string[],
    },
  };

  await new Promise<void>((resolve, reject) => {
    AppleHealthKit.initHealthKit(permissions, (err: string) => {
      if (err) reject(new Error(err === 'Auth not granted' ? 'permission_denied' : err));
      else resolve();
    });
  });

  const startDate = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

  // react-native-health 1.x API: getSamples with type, getOxygenSaturationSamples,
  // getSleepSamples all use callback(error, results) pattern.
  const [workouts, spo2Samples, sleepSamples] = await Promise.all([
    new Promise<any[]>((resolve, reject) =>
      AppleHealthKit.getSamples(
        { startDate, type: 'Workout' } as any,
        (err: string, r: any) => (err ? reject(new Error(err)) : resolve(Array.isArray(r) ? r : [])),
      )),
    new Promise<any[]>((resolve) =>
      AppleHealthKit.getOxygenSaturationSamples(
        { startDate } as any,
        (_err: string, r: any) => resolve(Array.isArray(r) ? r : []),
      )),
    new Promise<any[]>((resolve) =>
      AppleHealthKit.getSleepSamples(
        { startDate } as any,
        (_err: string, r: any) => resolve(Array.isArray(r) ? r : []),
      )),
  ]);

  const synced = await getSyncedSet();
  let submitted = 0;

  // ── Workouts ─────────────────────────────────────────────────────────
  for (const workout of workouts) {
    const id = `hk_${workout.sourceId ?? 'hk'}_${workout.startDate}`;
    if (synced.has(id)) continue;
    const duration = durationMinutes(workout.startDate, workout.endDate);
    if (duration < MIN_DURATION_MINUTES) continue;
    try {
      await PricingApi.submitEvent({
        member_id: memberId,
        event_type: 'activity_checkin',
        channel: 'app',
        timestamp: workout.startDate,
        metadata: {
          activity_type: hkActivityType(workout.activityName ?? ''),
          duration_minutes: duration,
          source: 'healthkit',
        },
      });
      synced.add(id);
      submitted++;
    } catch { /* retry next sync */ }
  }

  // ── SpO2 — lowest per day ────────────────────────────────────────────
  const spo2ByDay = new Map<string, { id: string; pct: number; time: string }>();
  for (const s of spo2Samples) {
    const id = `hk_spo2_${s.startDate}`;
    if (synced.has(id)) continue;
    const day = (s.startDate as string).slice(0, 10);
    // react-native-health returns value as 0–1 fraction
    const pct = typeof s.value === 'number' ? s.value * 100 : 0;
    const existing = spo2ByDay.get(day);
    if (!existing || pct < existing.pct) spo2ByDay.set(day, { id, pct, time: s.startDate });
  }
  for (const { id, pct, time } of spo2ByDay.values()) {
    try {
      await PricingApi.submitEvent({
        member_id: memberId,
        event_type: 'spo2_reading',
        channel: 'app',
        timestamp: time,
        raw_value: JSON.stringify({ result: `${pct.toFixed(1)}%`, source: 'healthkit' }),
      });
      synced.add(id);
      submitted++;
    } catch { /* retry next sync */ }
  }

  // ── Sleep — aggregate ASLEEP stages per night ────────────────────────
  const sleepByNight = new Map<string, { totalMins: number; earliestStart: string; ids: string[] }>();
  for (const s of sleepSamples) {
    if (s.value !== 'ASLEEP' && s.value !== 'CORE' && s.value !== 'DEEP' && s.value !== 'REM') continue;
    const id = `hk_sleep_${s.startDate}`;
    if (synced.has(id)) continue;
    const night = (s.startDate as string).slice(0, 10);
    const mins = durationMinutes(s.startDate, s.endDate);
    const entry = sleepByNight.get(night) ?? { totalMins: 0, earliestStart: s.startDate, ids: [] };
    entry.totalMins += mins;
    if (s.startDate < entry.earliestStart) entry.earliestStart = s.startDate;
    entry.ids.push(id);
    sleepByNight.set(night, entry);
  }
  for (const { totalMins, earliestStart, ids } of sleepByNight.values()) {
    const hrs = totalMins / 60;
    if (hrs < 0.5) continue;
    try {
      await PricingApi.submitEvent({
        member_id: memberId,
        event_type: 'sleep_log',
        channel: 'app',
        timestamp: earliestStart,
        raw_value: JSON.stringify({ result: `${hrs.toFixed(1)}h`, source: 'healthkit' }),
      });
      ids.forEach(id => synced.add(id));
      submitted++;
    } catch { /* retry next sync */ }
  }

  await saveSyncedSet(synced);
  return submitted;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function isWatchSyncAvailable(): Promise<boolean> {
  if (Platform.OS === 'android') return isHealthConnectAvailableAndroid();
  if (Platform.OS === 'ios') return true;
  return false;
}

export async function syncWatchSessions(memberId: string): Promise<number> {
  if (Platform.OS === 'android') return syncAndroid(memberId);
  if (Platform.OS === 'ios') return syncIos(memberId);
  return 0;
}
