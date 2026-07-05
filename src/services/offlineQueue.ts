// Offline write queue — implements Frontend & Backend Spec, Section 3.5.
//
// All write actions (screening log, activity check-in, medication confirm)
// queue locally first and sync when connectivity returns. The UI never
// blocks on network availability for these actions.
//
// Idempotent event IDs (uuid generated client-side, carried through to the
// backend's engagement_event record) ensure a retried request after a
// dropped connection never double-counts a check-in — see Section 5 of the
// spec, "Data Model Extensions."

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { PricingApi } from './api';
import { EngagementEventRequest } from '../types/api';

const QUEUE_KEY = '@wellness/offline_queue_v1';

export interface QueuedEvent {
  localId: string; // idempotency key, generated at enqueue time
  event: EngagementEventRequest;
  enqueuedAt: string;
  attempts: number;
}

function generateLocalId(): string {
  // RFC4122-ish v4, good enough for an idempotency key — replace with
  // `react-native-uuid` if stricter collision guarantees are needed.
  return (
    'evt_' +
    Date.now().toString(36) +
    '_' +
    Math.random().toString(36).slice(2, 10)
  );
}

async function readQueue(): Promise<QueuedEvent[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as QueuedEvent[]) : [];
}

async function writeQueue(queue: QueuedEvent[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// Call this from any screen action (screening log, activity check-in, etc.)
// instead of calling PricingApi.submitEvent directly. Returns immediately
// so the UI can optimistically update without waiting on the network.
export async function enqueueEngagementEvent(
  event: Omit<EngagementEventRequest, 'timestamp'>,
): Promise<QueuedEvent> {
  const queued: QueuedEvent = {
    localId: generateLocalId(),
    event: { ...event, timestamp: new Date().toISOString() },
    enqueuedAt: new Date().toISOString(),
    attempts: 0,
  };
  const queue = await readQueue();
  queue.push(queued);
  await writeQueue(queue);

  // Fire a sync attempt immediately in case we're online — this is the
  // common case and keeps perceived latency low without changing the
  // queue-first contract above.
  void flushQueue();

  return queued;
}

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 30_000; // 30s, doubles each retry: 30s, 60s, 120s, 240s, 480s

let flushInFlight = false;

// Drains the queue against the live API. Safe to call repeatedly (e.g. on
// every NetInfo "back online" event) — re-entrant calls are no-ops while a
// flush is already running.
export async function flushQueue(): Promise<void> {
  if (flushInFlight) {
    return;
  }
  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    return;
  }

  flushInFlight = true;
  try {
    const queue = await readQueue();
    const remaining: QueuedEvent[] = [];
    const now = Date.now();

    for (const item of queue) {
      if (item.attempts >= MAX_ATTEMPTS) {
        // Dead-letter: discard permanently after max retries to unblock the queue.
        // The event was already applied optimistically to the UI, so no user action needed.
        console.warn(
          '[offlineQueue] dead-lettering event after max attempts',
          item.localId,
        );
        continue;
      }

      // Exponential backoff — skip if we're still within the cooldown window.
      const backoffMs = BASE_BACKOFF_MS * Math.pow(2, item.attempts);
      const readyAt = new Date(item.enqueuedAt).getTime() + backoffMs;
      if (now < readyAt) {
        remaining.push(item);
        continue;
      }

      try {
        // localId was generated at enqueue time and never actually reached
        // the backend until now — the header comment above claimed this
        // wiring existed, but it didn't. Without it, a retried submission
        // after a dropped connection (exactly the case this queue exists
        // for) double-counted the scored check-in.
        await PricingApi.submitEvent(item.event, item.localId);
      } catch {
        remaining.push({ ...item, attempts: item.attempts + 1 });
      }
    }

    await writeQueue(remaining);
  } finally {
    flushInFlight = false;
  }
}

export async function getPendingCount(): Promise<number> {
  const queue = await readQueue();
  return queue.length;
}

// Wire this once at app startup (see App.tsx) so reconnect events trigger
// an automatic flush without any screen needing to know about NetInfo.
export function startQueueAutoFlush(): () => void {
  const unsubscribe = NetInfo.addEventListener(state => {
    if (state.isConnected) {
      void flushQueue();
    }
  });
  return unsubscribe;
}
