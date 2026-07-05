// Watch sync — Android: Health Connect (react-native-health-connect 3.x)
//              iOS:     HealthKit    (react-native-health 1.x)
// Static imports are used throughout; Platform.OS guards prevent execution
// on the wrong platform. Metro's tree-shaker keeps bundles clean.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PricingApi } from './api';

// ─── Types ──────────────────────────────────────────────────────────────────
// Import types statically so the compiler can validate them without executing
// the native modules at module load time.
import type { Permission, RecordType } from 'react-native-health-connect';
import type { HealthPermission } from 'react-native-health';

// ─── Constants ───────────────────────────────────────────────────────────────

// v2 key clears the old unbounded string[] format and migrates to a timestamped
// map so entries can be pruned automatically after the sync window expires.
const SYNCED_IDS_KEY = 'wellness:watch:synced_ids_v2';
const MIN_DURATION_MINUTES = 15;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function durationMinutes(startTime: string, endTime: string): number {
  return Math.round(
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60_000,
  );
}

// Synced-IDs store: Record<id, addedAtMs> so entries older than the sync
// window can be pruned on every save — prevents unbounded AsyncStorage growth.
async function getSyncedSet(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(SYNCED_IDS_KEY);
  if (!raw) {
    return new Set();
  }
  const map = JSON.parse(raw) as Record<string, number>;
  const cutoff = Date.now() - EIGHT_DAYS_MS;
  return new Set(
    Object.entries(map)
      .filter(([, t]) => t > cutoff)
      .map(([id]) => id),
  );
}

async function saveSyncedSet(ids: Set<string>): Promise<void> {
  const raw = await AsyncStorage.getItem(SYNCED_IDS_KEY);
  const existing: Record<string, number> = raw
    ? (JSON.parse(raw) as Record<string, number>)
    : {};
  const cutoff = Date.now() - EIGHT_DAYS_MS;
  const now = Date.now();
  const pruned: Record<string, number> = {};
  for (const [id, t] of Object.entries(existing)) {
    if (t > cutoff && ids.has(id)) {
      pruned[id] = t;
    }
  }
  for (const id of ids) {
    if (!pruned[id]) {
      pruned[id] = now;
    }
  }
  await AsyncStorage.setItem(SYNCED_IDS_KEY, JSON.stringify(pruned));
}

// ─── Android — Health Connect ─────────────────────────────────────────────────

const HC_EXERCISE_TYPE_MAP: Record<number, string> = {
  8: 'cycling',
  21: 'cycling',
  24: 'dancing',
  31: 'football',
  39: 'hiking',
  46: 'jump_rope',
  54: 'pilates',
  62: 'running',
  63: 'running',
  74: 'walking',
  85: 'walking',
  76: 'gym',
  87: 'gym',
  80: 'swimming',
  79: 'swimming',
  89: 'yoga',
  48: 'gym',
  38: 'gym',
};

function hcActivityType(exerciseType: number): string {
  return HC_EXERCISE_TYPE_MAP[exerciseType] ?? 'other';
}

// Typed permission list using the real RecordType union.
const REQUIRED_HC_PERMISSIONS: Permission[] = [
  { accessType: 'read', recordType: 'ExerciseSession' as RecordType },
  { accessType: 'read', recordType: 'OxygenSaturation' as RecordType },
  { accessType: 'read', recordType: 'SleepSession' as RecordType },
];

async function isHealthConnectAvailableAndroid(): Promise<boolean> {
  try {
    const hc =
      require('react-native-health-connect') as typeof import('react-native-health-connect');
    const status = await hc.getSdkStatus();
    return status === hc.SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

async function syncAndroid(memberId: string): Promise<number> {
  const hc =
    require('react-native-health-connect') as typeof import('react-native-health-connect');

  await hc.initialize();

  const existing = await hc.getGrantedPermissions();
  const grantedSet = new Set(
    existing
      .filter(
        (p): p is Permission => 'recordType' in p && p.accessType === 'read',
      )
      .map(p => p.recordType),
  );

  const missing = REQUIRED_HC_PERMISSIONS.filter(
    p => !grantedSet.has(p.recordType),
  );
  if (missing.length > 0) {
    const granted = await hc.requestPermission(missing);
    const hasExercise = granted.some(
      (p): p is Permission =>
        'recordType' in p && p.recordType === 'ExerciseSession',
    );
    if (!hasExercise && !grantedSet.has('ExerciseSession' as RecordType)) {
      throw new Error('permission_denied');
    }
  }

  const timeRangeFilter = {
    operator: 'between' as const,
    startTime: new Date(Date.now() - SEVEN_DAYS_MS).toISOString(),
    endTime: new Date().toISOString(),
  };

  const [exerciseResult, spo2Result, sleepResult] = await Promise.all([
    hc.readRecords('ExerciseSession', { timeRangeFilter }),
    hc.readRecords('OxygenSaturation', { timeRangeFilter }),
    hc.readRecords('SleepSession', { timeRangeFilter }),
  ]);

  const synced = await getSyncedSet();
  let submitted = 0;

  // Exercise sessions
  for (const session of exerciseResult.records) {
    const id: string = (session as any).metadata?.id ?? '';
    if (!id || synced.has(id)) {
      continue;
    }
    const dur = durationMinutes(
      (session as any).startTime,
      (session as any).endTime,
    );
    if (dur < MIN_DURATION_MINUTES) {
      continue;
    }
    try {
      await PricingApi.submitEvent(
        {
          member_id: memberId,
          event_type: 'activity_checkin',
          channel: 'app',
          timestamp: (session as any).startTime,
          raw_value: JSON.stringify({
            activity_type: hcActivityType((session as any).exerciseType ?? 0),
            duration_minutes: dur,
            source: 'health_connect',
          }),
        },
        id,
      );
      synced.add(id);
      submitted++;
    } catch {
      /* retry next sync */
    }
  }

  // SpO2 — lowest reading per day
  const spo2ByDay = new Map<
    string,
    { id: string; pct: number; time: string }
  >();
  for (const rec of spo2Result.records) {
    const id: string = (rec as any).metadata?.id ?? '';
    if (!id || synced.has(id)) {
      continue;
    }
    const day: string = ((rec as any).time as string).slice(0, 10);
    const pct: number =
      (rec as any).percentage?.value ?? (rec as any).percentage ?? 0;
    const lowest = spo2ByDay.get(day);
    if (!lowest || pct < lowest.pct) {
      spo2ByDay.set(day, { id, pct, time: (rec as any).time });
    }
  }
  for (const { id, pct, time } of spo2ByDay.values()) {
    try {
      await PricingApi.submitEvent(
        {
          member_id: memberId,
          event_type: 'spo2_reading',
          channel: 'app',
          timestamp: time,
          raw_value: JSON.stringify({
            result: `${pct.toFixed(1)}%`,
            source: 'health_connect',
          }),
        },
        id,
      );
      synced.add(id);
      submitted++;
    } catch {
      /* retry next sync */
    }
  }

  // Sleep sessions
  for (const session of sleepResult.records) {
    const id: string = (session as any).metadata?.id ?? '';
    if (!id || synced.has(id)) {
      continue;
    }
    const hrs =
      durationMinutes((session as any).startTime, (session as any).endTime) /
      60;
    if (hrs < 0.5) {
      continue;
    }
    try {
      await PricingApi.submitEvent(
        {
          member_id: memberId,
          event_type: 'sleep_log',
          channel: 'app',
          timestamp: (session as any).startTime,
          raw_value: JSON.stringify({
            result: `${hrs.toFixed(1)}h`,
            source: 'health_connect',
          }),
        },
        id,
      );
      synced.add(id);
      submitted++;
    } catch {
      /* retry next sync */
    }
  }

  await saveSyncedSet(synced);
  return submitted;
}

// ─── iOS — HealthKit ──────────────────────────────────────────────────────────

const HK_ACTIVITY_TYPE_MAP: Record<string, string> = {
  HKWorkoutActivityTypeCycling: 'cycling',
  HKWorkoutActivityTypeRunning: 'running',
  HKWorkoutActivityTypeWalking: 'walking',
  HKWorkoutActivityTypeSwimming: 'swimming',
  HKWorkoutActivityTypeYoga: 'yoga',
  HKWorkoutActivityTypePilates: 'pilates',
  HKWorkoutActivityTypeDancing: 'dancing',
  HKWorkoutActivityTypeHiking: 'hiking',
  HKWorkoutActivityTypeJumpRope: 'jump_rope',
  HKWorkoutActivityTypeTraditionalStrengthTraining: 'gym',
  HKWorkoutActivityTypeFunctionalStrengthTraining: 'gym',
  HKWorkoutActivityTypeHighIntensityIntervalTraining: 'gym',
  HKWorkoutActivityTypeMartialArts: 'gym',
  HKWorkoutActivityTypeAmericanFootball: 'football',
  HKWorkoutActivityTypeSoccer: 'football',
};

function hkActivityType(workoutType: string): string {
  return HK_ACTIVITY_TYPE_MAP[workoutType] ?? 'other';
}

async function syncIos(memberId: string): Promise<number> {
  const AppleHealthKit = (
    require('react-native-health') as typeof import('react-native-health')
  ).default;

  const READ: HealthPermission[] = [
    AppleHealthKit.Constants.Permissions.Workout,
    AppleHealthKit.Constants.Permissions.OxygenSaturation,
    AppleHealthKit.Constants.Permissions.SleepAnalysis,
  ];

  await new Promise<void>((resolve, reject) => {
    AppleHealthKit.initHealthKit(
      { permissions: { read: READ, write: [] as HealthPermission[] } },
      (err: string) => {
        if (err) {
          reject(
            new Error(err === 'Auth not granted' ? 'permission_denied' : err),
          );
        } else {
          resolve();
        }
      },
    );
  });

  const startDate = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();

  const [workouts, spo2Samples, sleepSamples] = await Promise.all([
    new Promise<any[]>((resolve, reject) =>
      AppleHealthKit.getSamples(
        { startDate, type: 'Workout' } as any,
        (err: string, r: any) =>
          err ? reject(new Error(err)) : resolve(Array.isArray(r) ? r : []),
      ),
    ),
    new Promise<any[]>(resolve =>
      AppleHealthKit.getOxygenSaturationSamples(
        { startDate } as any,
        (_err: string, r: any) => resolve(Array.isArray(r) ? r : []),
      ),
    ),
    new Promise<any[]>(resolve =>
      AppleHealthKit.getSleepSamples(
        { startDate } as any,
        (_err: string, r: any) => resolve(Array.isArray(r) ? r : []),
      ),
    ),
  ]);

  const synced = await getSyncedSet();
  let submitted = 0;

  // Workouts
  for (const workout of workouts) {
    const id = `hk_${workout.sourceId ?? 'hk'}_${workout.startDate}`;
    if (synced.has(id)) {
      continue;
    }
    const dur = durationMinutes(workout.startDate, workout.endDate);
    if (dur < MIN_DURATION_MINUTES) {
      continue;
    }
    try {
      await PricingApi.submitEvent(
        {
          member_id: memberId,
          event_type: 'activity_checkin',
          channel: 'app',
          timestamp: workout.startDate,
          raw_value: JSON.stringify({
            activity_type: hkActivityType(workout.activityName ?? ''),
            duration_minutes: dur,
            source: 'healthkit',
          }),
        },
        id,
      );
      synced.add(id);
      submitted++;
    } catch {
      /* retry next sync */
    }
  }

  // SpO2 — lowest per day
  const spo2ByDay = new Map<
    string,
    { id: string; pct: number; time: string }
  >();
  for (const s of spo2Samples) {
    const id = `hk_spo2_${s.startDate}`;
    if (synced.has(id)) {
      continue;
    }
    const day = (s.startDate as string).slice(0, 10);
    const pct = typeof s.value === 'number' ? s.value * 100 : 0;
    const existing = spo2ByDay.get(day);
    if (!existing || pct < existing.pct) {
      spo2ByDay.set(day, { id, pct, time: s.startDate });
    }
  }
  for (const { id, pct, time } of spo2ByDay.values()) {
    try {
      await PricingApi.submitEvent(
        {
          member_id: memberId,
          event_type: 'spo2_reading',
          channel: 'app',
          timestamp: time,
          raw_value: JSON.stringify({
            result: `${pct.toFixed(1)}%`,
            source: 'healthkit',
          }),
        },
        id,
      );
      synced.add(id);
      submitted++;
    } catch {
      /* retry next sync */
    }
  }

  // Sleep — aggregate ASLEEP stages per night
  const sleepByNight = new Map<
    string,
    { totalMins: number; earliestStart: string; ids: string[] }
  >();
  for (const s of sleepSamples) {
    if (
      s.value !== 'ASLEEP' &&
      s.value !== 'CORE' &&
      s.value !== 'DEEP' &&
      s.value !== 'REM'
    ) {
      continue;
    }
    const id = `hk_sleep_${s.startDate}`;
    if (synced.has(id)) {
      continue;
    }
    const night = (s.startDate as string).slice(0, 10);
    const mins = durationMinutes(s.startDate, s.endDate);
    const entry = sleepByNight.get(night) ?? {
      totalMins: 0,
      earliestStart: s.startDate as string,
      ids: [] as string[],
    };
    entry.totalMins += mins;
    if ((s.startDate as string) < entry.earliestStart) {
      entry.earliestStart = s.startDate as string;
    }
    entry.ids.push(id);
    sleepByNight.set(night, entry);
  }
  for (const { totalMins, earliestStart, ids } of sleepByNight.values()) {
    const hrs = totalMins / 60;
    if (hrs < 0.5) {
      continue;
    }
    // This submission aggregates several raw sleep-stage samples into one
    // event, so there's no single source `id` to key off (unlike the loops
    // above) — earliestStart is deterministic for the same night's samples,
    // so it's a stable idempotency key across retries.
    const aggregateId = `hk_sleep_agg_${earliestStart}`;
    try {
      await PricingApi.submitEvent(
        {
          member_id: memberId,
          event_type: 'sleep_log',
          channel: 'app',
          timestamp: earliestStart,
          raw_value: JSON.stringify({
            result: `${hrs.toFixed(1)}h`,
            source: 'healthkit',
          }),
        },
        aggregateId,
      );
      ids.forEach(id => synced.add(id));
      submitted++;
    } catch {
      /* retry next sync */
    }
  }

  await saveSyncedSet(synced);
  return submitted;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function isWatchSyncAvailable(): Promise<boolean> {
  if (Platform.OS === 'android') {
    return isHealthConnectAvailableAndroid();
  }
  if (Platform.OS === 'ios') {
    return true;
  }
  return false;
}

export async function syncWatchSessions(memberId: string): Promise<number> {
  if (Platform.OS === 'android') {
    return syncAndroid(memberId);
  }
  if (Platform.OS === 'ios') {
    return syncIos(memberId);
  }
  return 0;
}
