/**
 * Calendar-date helpers. Everything here operates on ISO date strings
 * (`YYYY-MM-DD`) — a calendar date is not an instant in time, so `Date` objects
 * only ever appear transiently inside these functions, never in the data model.
 *
 * The cardinal rule: never `new Date(isoString)`. That parses as UTC midnight,
 * which lands on the previous local day west of Greenwich. Always go through
 * `parseISODateLocal`.
 */

/**
 * Parse an ISO date string into a local `Date` anchored at noon.
 *
 * Noon, not midnight: a DST transition can shift midnight by an hour and land
 * the date on the previous day. Noon has 11 hours of slack in either direction,
 * so day/month/year always read back as written.
 */
export function parseISODateLocal(iso: string): Date {
  const parts = iso.split('-');
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return new Date(year, month - 1, day, 12);
}

/**
 * Whether a string is a real `YYYY-MM-DD` calendar date. Rejects the wrong
 * shape (`''`, `2026-07`, `July 27`) and impossible dates that pass the shape
 * (`2026-02-30`, `2026-13-01`). This is the gate that keeps a malformed value —
 * e.g. a cleared date input — from ever reaching `Schedule.startDate` and
 * poisoning every downstream date calculation with `NaN`.
 */
export function isValidISODate(iso: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/** Format a `Date` as `YYYY-MM-DD` using its local components. */
export function formatISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** ISO date `days` after `iso` (negative goes backwards). */
export function addDays(iso: string, days: number): string {
  const date = parseISODateLocal(iso);
  date.setDate(date.getDate() + days);
  return formatISODate(date);
}

/**
 * The Monday of the week containing `iso`. The week always starts on Monday, so
 * Sunday belongs to the week that just ended, not the one about to begin.
 */
export function mondayOf(iso: string): string {
  const dayOfWeek = parseISODateLocal(iso).getDay(); // 0 = Sun … 6 = Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addDays(iso, -daysSinceMonday);
}

/**
 * Split a date into the two lines a column header shows: a short weekday
 * (`Mon`) over a short month/day (`Jul 27`). Fixed to en-US so the header reads
 * the same everywhere — this is a document, not a localized UI.
 */
export function formatDayHeader(iso: string): {
  weekday: string;
  date: string;
} {
  const date = parseISODateLocal(iso);
  return {
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  };
}

/** A date span as `Jul 27 – Aug 9, 2026` — the year appears once, at the end. */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = parseISODateLocal(startIso);
  const end = parseISODateLocal(endIso);
  const startLabel = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  const endLabel = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return `${startLabel} – ${endLabel}`;
}
