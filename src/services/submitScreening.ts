// One screening submission, as a pure orchestration.
//
// WHY THIS IS ITS OWN MODULE. It mirrors the PWA's submit path (direct POST
// first, offline queue only on failure) so the two clients stop having
// different write paths — divergent write paths are how the last three drifts
// in this codebase started. But the part that most needs proving cannot be
// proved on a phone: that the direct attempt and the queued replay carry THE
// SAME idempotency key.
//
// The server is idempotent on that key, so a double-fire (direct succeeds, the
// queue replays anyway) collapses to one event. The real risk is two DIFFERENT
// keys, which the server cannot possibly collapse — it would record the
// reading twice. That is a property of this function alone, so this function
// takes its collaborators as arguments and imports nothing from react-native,
// which is what lets a plain jest test pin it with no device and no APK.

import type {
  EngagementEventRequest,
  EngagementEventResponse,
  EventType,
} from '../types/api';
// Type-only: erased at compile time, so this module stays free of any runtime
// dependency on the presentation layer (and therefore on react-native).
import type { ServerAssessment } from './assessmentPresentation';

export interface SubmitDeps {
  submitEvent: (
    event: EngagementEventRequest,
    idempotencyKey: string,
  ) => Promise<EngagementEventResponse>;
  enqueue: (
    event: Omit<EngagementEventRequest, 'timestamp'>,
    evidenceDataUrl: string | undefined,
    localId: string,
  ) => Promise<unknown>;
  attachEvidence: (eventId: string, evidenceUrl: string) => Promise<unknown>;
  newKey: () => string;
  nowIso: () => string;
}

export interface SubmitArgs {
  memberId: string;
  eventType: EventType;
  // Optional because some screening types carry no value to send (the builder
  // returns undefined for them) — the event itself is still real.
  rawValue: string | undefined;
  evidenceDataUrl?: string | undefined;
}

export type SubmitOutcome =
  // The server took it AND classified it. The only way a member sees a band.
  | {
      kind: 'assessed';
      assessment: ServerAssessment;
      eventId: string | null;
      evidenceAttached: boolean;
      keyUsed: string;
    }
  // The server took it, but there was nothing to classify (eye, dental, an
  // unparseable value). Deliberately distinct from 'assessed': the screen must
  // not clear or invent a band here.
  | {
      kind: 'logged';
      eventId: string | null;
      evidenceAttached: boolean;
      keyUsed: string;
    }
  // Offline. Saved locally, will be assessed when the queue flushes. NO
  // CLASSIFICATION WITHOUT A SERVER — this promises an assessment, never a
  // verdict.
  | { kind: 'queued'; keyUsed: string };

export async function submitScreening(
  deps: SubmitDeps,
  args: SubmitArgs,
): Promise<SubmitOutcome> {
  // Minted ONCE, before either path. Both branches below use this exact value.
  const keyUsed = deps.newKey();

  const body: Omit<EngagementEventRequest, 'timestamp'> = {
    member_id: args.memberId,
    event_type: args.eventType,
    channel: 'app',
    raw_value: args.rawValue,
  };

  try {
    const resp = await deps.submitEvent(
      { ...body, timestamp: deps.nowIso() },
      keyUsed,
    );

    // Evidence is attached in its own try. A failed photo upload must never
    // fall through to the queue branch: the reading is already recorded, and
    // re-submitting it there would be a second submission of a reading the
    // server already has. The photo is reported as unattached instead, so the
    // screen can say so rather than implying the slip is on file.
    let evidenceAttached = false;
    if (args.evidenceDataUrl && resp.event_id) {
      try {
        await deps.attachEvidence(resp.event_id, args.evidenceDataUrl);
        evidenceAttached = true;
      } catch {
        evidenceAttached = false;
      }
    }

    const eventId = resp.event_id ?? null;
    if (resp.assessment) {
      return {
        kind: 'assessed',
        assessment: resp.assessment,
        eventId,
        evidenceAttached,
        keyUsed,
      };
    }
    return { kind: 'logged', eventId, evidenceAttached, keyUsed };
  } catch {
    // Network failure, timeout, or a server error. The SAME key goes to the
    // queue, so the replay is the same submission rather than a new one.
    await deps.enqueue(body, args.evidenceDataUrl, keyUsed);
    return { kind: 'queued', keyUsed };
  }
}
