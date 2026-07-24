import type { Assignment, Schedule } from '../types.ts';
import { DAYS_PER_WEEK, TIME_INCREMENT_MINUTES } from '../constants.ts';
import { cellKey, getAssignment } from '../state/scheduleReducer.ts';
import { isValidSchedule } from '../state/scheduleStorage.ts';

/**
 * Encodes a schedule into a compact, URL-safe string for a "view-only" share
 * link (`…/#r=<string>`). Dependency-free and deliberately terse to keep links
 * short enough to paste in a chat.
 *
 * Layout (sections joined by `.`, which never appears in the parts):
 *   1.<weekCount>.<YYYYMMDD>.<namesB64url>.<assignments>[.<titleB64url>]
 *
 * Each person's assignments are a positional run of day codes, people separated
 * by `~`, trailing empty days dropped:
 *   e=empty  o=off  p=pto  h=holiday  s<start><dur>=shift
 * where <start>/<dur> are single chars indexing the 30-minute slot into the
 * base64url alphabet. Decoding regenerates fresh person ids and runs the result
 * through `isValidSchedule`, so a link is always treated as untrusted input.
 */

const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function slotChar(minutes: number): string {
  const index = Math.round(minutes / TIME_INCREMENT_MINUTES);
  return ALPHABET[Math.max(0, Math.min(ALPHABET.length - 1, index))]!;
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(data: string): string {
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded); // throws on invalid input — callers catch
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodePerson(
  schedule: Schedule,
  personId: string,
  dayCount: number,
): string {
  const codes: string[] = [];
  for (let day = 0; day < dayCount; day++) {
    const assignment = getAssignment(schedule, personId, day);
    switch (assignment.kind) {
      case 'empty':
        codes.push('e');
        break;
      case 'off':
        codes.push('o');
        break;
      case 'pto':
        codes.push('p');
        break;
      case 'holiday':
        codes.push('h');
        break;
      case 'shift':
        codes.push(
          's' + slotChar(assignment.start) + slotChar(assignment.duration),
        );
        break;
    }
  }
  // Trailing empty days carry no information — the decoder defaults them.
  while (codes.length > 0 && codes[codes.length - 1] === 'e') codes.pop();
  return codes.join('');
}

export function encodeShare(schedule: Schedule): string {
  const dayCount = schedule.weekCount * DAYS_PER_WEEK;
  const date = schedule.startDate.replace(/-/g, '');
  const names = toBase64Url(schedule.people.map((p) => p.name).join('\n'));
  const assignments = schedule.people
    .map((person) => encodePerson(schedule, person.id, dayCount))
    .join('~');

  const parts = [`1`, String(schedule.weekCount), date, names, assignments];
  const title = (schedule.title ?? '').trim();
  if (title) parts.push(toBase64Url(title));
  return parts.join('.');
}

/** Parse one person's positional day-code run into a sparse day→assignment map. */
function decodePerson(
  segment: string,
  dayCount: number,
): Record<number, Assignment> | null {
  const out: Record<number, Assignment> = {};
  let day = 0;
  let i = 0;
  while (i < segment.length && day < dayCount) {
    const code = segment[i++];
    if (code === 'e') {
      day++;
    } else if (code === 'o') {
      out[day++] = { kind: 'off' };
    } else if (code === 'p') {
      out[day++] = { kind: 'pto' };
    } else if (code === 'h') {
      out[day++] = { kind: 'holiday' };
    } else if (code === 's') {
      const start = ALPHABET.indexOf(segment[i++] ?? '');
      const duration = ALPHABET.indexOf(segment[i++] ?? '');
      if (start < 0 || duration < 0) return null;
      out[day++] = {
        kind: 'shift',
        start: start * TIME_INCREMENT_MINUTES,
        duration: duration * TIME_INCREMENT_MINUTES,
      };
    } else {
      return null; // unexpected character — malformed
    }
  }
  return out;
}

export function decodeShare(data: string): Schedule | null {
  if (!data) return null;
  const parts = data.split('.');
  if (parts.length < 5 || parts.length > 6) return null;

  const [version, weekStr, date, namesB64, assignmentsStr, titleB64] = parts;
  if (version !== '1') return null;
  const weekCount = weekStr === '1' ? 1 : weekStr === '2' ? 2 : null;
  if (weekCount === null) return null;
  if (!/^\d{8}$/.test(date ?? '')) return null;
  const startDate = `${date!.slice(0, 4)}-${date!.slice(4, 6)}-${date!.slice(6, 8)}`;

  let names: string[];
  try {
    names = namesB64 ? fromBase64Url(namesB64).split('\n') : [];
  } catch {
    return null;
  }

  const dayCount = weekCount * DAYS_PER_WEEK;
  const segments = assignmentsStr ? assignmentsStr.split('~') : [];
  const people = names.map((name) => ({ id: crypto.randomUUID(), name }));
  const assignments: Record<string, Assignment> = {};

  for (let i = 0; i < people.length; i++) {
    const dayMap = decodePerson(segments[i] ?? '', dayCount);
    if (dayMap === null) return null;
    for (const [dayStr, assignment] of Object.entries(dayMap)) {
      assignments[cellKey(people[i]!.id, Number(dayStr))] = assignment;
    }
  }

  let title: string | undefined;
  if (titleB64 !== undefined) {
    try {
      title = fromBase64Url(titleB64);
    } catch {
      return null;
    }
  }

  const schedule: Schedule = {
    version: 1,
    startDate,
    weekCount,
    people,
    assignments,
  };
  if (title) schedule.title = title;

  // Final guard: a link is untrusted, so it must pass the same validator storage does.
  return isValidSchedule(schedule) ? schedule : null;
}
