// Presentation for SERVER assessments — colours, titles, and banner copy per
// level. Mirrors the PWA's services/assessmentPresentation.ts.
//
// This module maps a level THE SERVER RETURNED onto pixels. It never decides
// what a reading means. Until this existed, this app carried five local
// classifiers (bpClass, glucoseClass, spo2Class, cholesterolClass, bmiClass)
// that had drifted from the backend grid — most dangerously, glucose had no
// hypoglycaemia branch at all, so a reading of 2.5 mmol/L rendered a green
// "Normal range" chip while the server classified it critical and set the
// ambulance flag. That is the same 840-cell drift the PWA was cleaned of in
// batch A, and it lived on here because the build guard only covered the PWA.
//
// The threshold table lives in exactly one place: backend alertService.ts,
// pinned by its grid test.

import { colors } from '../theme/tokens';
import type { EngagementEventResponse } from '../types/api';

// Derived from the API response rather than redeclared: a second copy of the
// shape is a second thing to drift.
export type ServerAssessment = NonNullable<
  EngagementEventResponse['assessment']
>;
export type AssessmentLevel = ServerAssessment['level'];

export const LEVEL_COLORS: Record<
  AssessmentLevel,
  { bg: string; text: string; border: string }
> = {
  green: { bg: colors.successBg, text: colors.successText, border: '#A9DDC1' },
  amber: { bg: colors.warningBg, text: colors.warningText, border: '#E8D2A0' },
  red: { bg: colors.dangerBg, text: colors.dangerText, border: '#F0B8B4' },
  // Solid, high-alarm red on purpose — critical drives the emergency banner
  // and the Call 997 action; it must read as more urgent than `red`.
  critical: { bg: '#B3261E', text: '#FFFFFF', border: '#7A1913' },
};

export const LEVEL_EMOJI: Record<AssessmentLevel, string> = {
  green: '🟢',
  amber: '🟡',
  red: '🔴',
  critical: '🆘',
};

export const LEVEL_TITLE: Record<AssessmentLevel, string> = {
  green: 'Green — Normal Range',
  amber: 'Amber — Keep an Eye On It',
  red: 'Red — Needs Attention',
  critical: '🆘 Critical — Emergency',
};

// What the member should DO, per level. Advice only — system actions are
// reported separately by actionLines(), from what the server said it did.
export const LEVEL_STEPS: Record<AssessmentLevel, string[]> = {
  green: [
    'Your result is within the normal range',
    'Keep up your current habits',
    'No clinical intervention required',
  ],
  amber: [
    'This reading is outside the normal range',
    'Monitor your results and re-test as advised',
    'If you feel unwell, contact your clinic',
  ],
  red: [
    'This reading needs medical attention',
    'Contact your clinic or visit a partner clinic soon',
    'If you feel unwell now, call 997',
  ],
  critical: [
    'This reading is at a dangerous level',
    'Go to your nearest clinic or call emergency services (997) NOW',
    'Do not wait',
  ],
};

// Honest-tense lines for what the server reported it did or is doing.
// The rule this exists for: claims about notifications come only from the
// surface that sends them. 'unavailable' / 'failed' / 'no_clinic' produce NO
// line — we never claim a send that didn't happen, and several of these legs
// are inert in production today (SMTP unset). The advice steps above already
// tell the member what to do themselves.
export function actionLines(a: ServerAssessment): string[] {
  if (!a.actions) {
    return [];
  }
  const lines: string[] = [];
  if (a.actions.inbox_message) {
    lines.push('Guidance has been added to your Messages inbox');
  }
  if (a.actions.sms === 'sending') {
    lines.push('We’re sending you an SMS with guidance');
  }
  if (a.actions.sms === 'sent') {
    lines.push('We’ve sent you an SMS with guidance');
  }
  if (a.actions.clinic_email === 'sending') {
    lines.push('We’re alerting your clinic by email');
  }
  if (a.actions.clinic_email === 'sent') {
    lines.push('Your clinic has been alerted by email');
  }
  if (a.actions.call_centre === 'sending') {
    lines.push('The call centre is being notified');
  }
  if (a.actions.call_centre === 'sent') {
    lines.push('The call centre has been notified');
  }
  return lines;
}
