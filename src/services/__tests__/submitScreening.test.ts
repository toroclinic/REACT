// The one property that cannot be checked on a phone: the direct attempt and
// the queued replay are the SAME submission.
//
// The server is idempotent on the idempotency key, so a double-fire collapses
// to one event. Two DIFFERENT keys cannot be collapsed by anything — the
// reading is simply recorded twice. Before this module existed, RN's queue
// minted its own key at enqueue time, so a direct attempt that timed out and
// then fell back to the queue was, to the server, two submissions.

import { submitScreening, type SubmitDeps } from '../submitScreening';
import type { EngagementEventResponse } from '../../types/api';

const OK: EngagementEventResponse = {
  accepted: true,
  current_score: 50,
  current_tier: 'Silver',
  event_id: 'evt_server_1',
  assessment: {
    level: 'amber',
    parameter: 'Blood Pressure',
    value_text: '135/85 mmHg',
    detail: 'Stage 1 hypertension',
    actions: null,
  },
};

function makeDeps(over: Partial<SubmitDeps> = {}) {
  const calls = {
    submitKeys: [] as string[],
    enqueueKeys: [] as string[],
    attached: [] as Array<[string, string]>,
  };
  let n = 0;
  const deps: SubmitDeps = {
    newKey: () => `key_${++n}`,
    nowIso: () => '2026-08-08T10:00:00.000Z',
    submitEvent: async (_e, key) => {
      calls.submitKeys.push(key);
      return OK;
    },
    enqueue: async (_e, _ev, localId) => {
      calls.enqueueKeys.push(localId);
    },
    attachEvidence: async (id, url) => {
      calls.attached.push([id, url]);
    },
    ...over,
  };
  return { deps, calls };
}

const ARGS = {
  memberId: 'mem_1',
  eventType: 'bp_screening' as const,
  rawValue: JSON.stringify({ date: '2026-08-08', result: '135/85 mmHg' }),
};

describe('one submission uses one idempotency key', () => {
  it('hands the queue the SAME key the direct attempt used', async () => {
    // Recorded outside makeDeps so the failing stub can capture the key it was
    // given — the key exists before the failure, which is the whole point.
    const submitKeys: string[] = [];
    const { deps, calls } = makeDeps({
      submitEvent: async (_e, key) => {
        submitKeys.push(key);
        throw new Error('network');
      },
    });

    const out = await submitScreening(deps, ARGS);

    expect(out.kind).toBe('queued');
    expect(submitKeys).toHaveLength(1);
    expect(calls.enqueueKeys).toHaveLength(1);
    // The assertion this file exists for.
    expect(calls.enqueueKeys[0]).toBe(submitKeys[0]);
    expect(out.keyUsed).toBe(submitKeys[0]);
  });

  it('mints exactly one key per submission, not one per attempt', async () => {
    let minted = 0;
    const { deps } = makeDeps({
      newKey: () => `key_${++minted}`,
      submitEvent: async () => {
        throw new Error('timeout');
      },
    });
    await submitScreening(deps, ARGS);
    expect(minted).toBe(1);
  });

  it('gives two separate submissions two different keys', async () => {
    const { deps, calls } = makeDeps();
    await submitScreening(deps, ARGS);
    await submitScreening(deps, ARGS);
    expect(calls.submitKeys[0]).not.toBe(calls.submitKeys[1]);
  });
});

describe('outcomes', () => {
  it('returns the server assessment when the server classified the reading', async () => {
    const { deps } = makeDeps();
    const out = await submitScreening(deps, ARGS);
    expect(out.kind).toBe('assessed');
    if (out.kind === 'assessed') {
      expect(out.assessment.level).toBe('amber');
      expect(out.eventId).toBe('evt_server_1');
    }
  });

  it('is "logged", not "assessed", when there is nothing to classify', async () => {
    // An eye test or an unparseable value. The screen must not invent a band
    // here, nor clear one that may still be carrying emergency instructions.
    const { deps } = makeDeps({
      submitEvent: async () => ({ ...OK, assessment: null }),
    });
    const out = await submitScreening(deps, ARGS);
    expect(out.kind).toBe('logged');
  });

  it('never classifies locally when offline', async () => {
    const { deps } = makeDeps({
      submitEvent: async () => {
        throw new Error('offline');
      },
    });
    const out = await submitScreening(deps, ARGS);
    // No level, no band, no verdict — only a promise of one.
    expect(out).toEqual({ kind: 'queued', keyUsed: expect.any(String) });
  });
});

describe('evidence', () => {
  it('attaches the slip photo to the event the server returned', async () => {
    const { deps, calls } = makeDeps();
    const out = await submitScreening(deps, {
      ...ARGS,
      evidenceDataUrl: 'data:image/jpeg;base64,xxx',
    });
    expect(calls.attached).toEqual([
      ['evt_server_1', 'data:image/jpeg;base64,xxx'],
    ]);
    if (out.kind === 'assessed') {
      expect(out.evidenceAttached).toBe(true);
    }
  });

  it('does NOT re-submit the reading when only the photo fails', async () => {
    // The reading is already recorded. Falling into the queue here would
    // submit it a second time — with a key the server has already seen for a
    // successful call, but the point stands: the failure is the photo's, not
    // the reading's, and the member is told the photo did not attach.
    const { deps, calls } = makeDeps({
      attachEvidence: async () => {
        throw new Error('413 payload too large');
      },
    });
    const out = await submitScreening(deps, {
      ...ARGS,
      evidenceDataUrl: 'data:image/jpeg;base64,huge',
    });
    expect(calls.enqueueKeys).toHaveLength(0);
    expect(out.kind).toBe('assessed');
    if (out.kind === 'assessed') {
      expect(out.evidenceAttached).toBe(false);
    }
  });

  it('carries the photo into the queue when the whole submission fails', async () => {
    const seen: Array<string | undefined> = [];
    const { deps } = makeDeps({
      submitEvent: async () => {
        throw new Error('offline');
      },
      enqueue: async (_e, evidenceDataUrl) => {
        seen.push(evidenceDataUrl);
      },
    });
    await submitScreening(deps, {
      ...ARGS,
      evidenceDataUrl: 'data:image/jpeg;base64,xxx',
    });
    expect(seen).toEqual(['data:image/jpeg;base64,xxx']);
  });
});
