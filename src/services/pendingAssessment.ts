// The post-log assessment banner, remembered across app restarts. Mirrors the
// PWA's services/pendingAssessment.ts, with AsyncStorage in place of
// localStorage (so every call here is async, unlike the web version).
//
// WHY IT IS PERSISTED. The banner can be carrying "call 997 NOW". Held in
// component state alone it dies with the screen — and this screen is unmounted
// routinely: the PIN lock tears down the tree after five minutes backgrounded,
// and Android will kill a backgrounded app outright under memory pressure. A
// member who logs a critical reading and then takes a phone call must not come
// back to a blank screen.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ServerAssessment } from './assessmentPresentation';

const KEY = 'wellness:pending_assessment';

// 'queued' is the offline state: the reading is saved locally and will be
// assessed when the queue flushes. NO CLASSIFICATION WITHOUT A SERVER — the
// queued banner promises an assessment, never a verdict.
export type BannerState =
  | { kind: 'assessed'; assessment: ServerAssessment; label: string }
  | { kind: 'queued'; label: string };

interface Stored {
  memberId: string;
  banner: BannerState;
  at: number;
}

// Long enough to survive an interruption, short enough that last week's
// reading isn't still shouting.
const TTL_MS = 24 * 60 * 60 * 1000;

export async function setPendingAssessment(
  memberId: string,
  banner: BannerState,
): Promise<void> {
  const payload: Stored = { memberId, banner, at: Date.now() };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    // Storage full or unavailable — the in-memory banner still renders for
    // this session. Losing persistence must never lose the banner itself.
  }
}

export async function getPendingAssessment(
  memberId: string,
): Promise<BannerState | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const stored = JSON.parse(raw) as Stored;
    // Belongs to whoever is signed in NOW. A shared device must never show one
    // member's reading to the next.
    if (stored.memberId !== memberId) {
      return null;
    }
    if (Date.now() - stored.at > TTL_MS) {
      return null;
    }
    return stored.banner;
  } catch {
    return null;
  }
}

export async function clearPendingAssessment(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // Non-fatal: a stale banner expires on its own via TTL.
  }
}
