// Client-side counterpart to the backend's src/services/tsBoundary.ts: every
// timestamp that arrives from the API must be parsed with this helper, never
// with a bare `new Date(value)`. Mirrors wellness-web/src/services/datetime.ts.
//
// The API's timestamp columns are TEXT on both adapters and hold TWO shapes:
//
//   "2026-07-26 11:21:51"          — stamped by the DDL default
//                                    (SQLite datetime('now') / Postgres NOW()):
//                                    SPACE separator, UTC, no zone suffix
//   "2026-07-26T11:21:51.000Z"     — rows written from JS via .toISOString()
//
// Both shapes coexist in the same column. member_message is the clearest case:
// the DB default stamps almost every insert, while the seeder and this app's
// own optimistic read_at write full ISO. Any parser here must handle both.
//
// The bug this exists to kill has two faces. ECMAScript parses a date-time
// string with NO zone designator as LOCAL time, but "YYYY-MM-DD HH:MM:SS" is
// UTC — so on JSC/iOS, in Botswana (UTC+2), a message created a second ago
// rendered as two hours old. Hermes on Android is stricter still and rejects
// the space-separated form outright, yielding an Invalid Date that reached the
// UI as the literal text "Invalid Date". Normalising the separator and adding
// the 'Z' the DB default omits fixes both engines at once.

/** Calendar dates — due_date, appointment_date, renewal_date, date_of_birth. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Trailing 'Z', '+02:00', '+0200', or Postgres' two-digit '+00'. */
const HAS_ZONE = /(?:[Zz]|[+-]\d{2}(?::?\d{2})?)$/;

/**
 * Parse a timestamp as returned by the API, in either of the two shapes above.
 *
 * Returns null — never an Invalid Date — for empty, malformed, or missing
 * input, so callers get one thing to check instead of a value that silently
 * poisons arithmetic into NaN or prints as "Invalid Date".
 *
 * Date-only strings are deliberately pinned to LOCAL midnight rather than UTC.
 * They are calendar dates, not instants: "due 2026-07-26" means the 26th in the
 * member's own day, and shifting it to UTC would show the wrong day to anyone
 * west of Greenwich.
 */
export function parseServerDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const raw = String(value).trim();
  if (!raw) {
    return null;
  }

  if (DATE_ONLY.test(raw)) {
    const dateOnly = new Date(`${raw}T00:00:00`);
    return Number.isNaN(dateOnly.getTime()) ? null : dateOnly;
  }

  let iso = raw.replace(' ', 'T');

  // Postgres can render microseconds into TEXT; the spec allows three
  // fractional digits and Hermes rejects more.
  iso = iso.replace(/(\.\d{3})\d+/, '$1');

  // Postgres also renders a bare two-digit offset ("...+00"), which no engine
  // will parse — it has to be widened to "+00:00" before Date sees it.
  iso = iso.replace(/([+-]\d{2})$/, '$1:00');

  // The DB default writes UTC but says so nowhere. Without this the string is
  // read as local time on JSC and refused outright by Hermes — the entire bug.
  if (!HAS_ZONE.test(iso)) {
    iso += 'Z';
  }

  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Epoch milliseconds for a server timestamp, or null if it cannot be parsed.
 * Useful for sorting and interval maths where a Date object is not wanted.
 */
export function serverDateMs(value: string | null | undefined): number | null {
  const parsed = parseServerDate(value);
  return parsed === null ? null : parsed.getTime();
}

/** Local midnight on the day `date` falls in — the basis for calendar-day maths. */
export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Whole calendar days from today to `value`, positive for the future.
 *
 * Both sides are collapsed to local midnight first. Subtracting raw timestamps
 * instead would mix a date-only value (midnight) against the current time of
 * day, so a reminder due today read as one day overdue after 12:00.
 */
export function daysFromToday(value: string | null | undefined): number | null {
  const parsed = parseServerDate(value);
  if (parsed === null) {
    return null;
  }
  const from = startOfLocalDay(new Date()).getTime();
  const to = startOfLocalDay(parsed).getTime();
  return Math.round((to - from) / 86400000);
}

/**
 * "Just now" / "5m ago" / "2h ago" / "3d ago" — returns '' when the timestamp
 * is missing or unparseable, so a broken value renders as nothing rather than
 * as "NaN ago" or "Invalid Date".
 *
 * Future timestamps collapse to "Just now": a member's device clock drifting a
 * few seconds behind the server should not produce "-1m ago".
 */
export function timeAgo(value: string | null | undefined): string {
  const ms = serverDateMs(value);
  if (ms === null) {
    return '';
  }

  const seconds = Math.floor((Date.now() - ms) / 1000);
  if (seconds < 60) {
    return 'Just now';
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }
  return `${Math.floor(seconds / 86400)}d ago`;
}
