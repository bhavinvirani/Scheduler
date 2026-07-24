import type { Assignment, Person, Schedule } from '../types.ts';
import { isValidISODate } from '../lib/dates.ts';

/** localStorage key. Namespaced and versioned so a schema bump can coexist. */
export const STORAGE_KEY = 'shift-scheduler:v1:current';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAssignment(value: unknown): value is Assignment {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'empty':
    case 'off':
    case 'pto':
    case 'holiday':
      return true;
    case 'shift':
      return (
        typeof value.start === 'number' &&
        Number.isFinite(value.start) &&
        typeof value.duration === 'number' &&
        Number.isFinite(value.duration)
      );
    default:
      return false;
  }
}

function isPerson(value: unknown): value is Person {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string'
  );
}

/**
 * Validate an unknown value as a `Schedule`. Treat everything that reaches here
 * as untrusted — a half-written or hand-edited localStorage blob (or an
 * imported JSON file) must never white-screen the app.
 */
export function isValidSchedule(value: unknown): value is Schedule {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (typeof value.startDate !== 'string' || !isValidISODate(value.startDate)) {
    return false;
  }
  if (value.weekCount !== 1 && value.weekCount !== 2) return false;
  // title is optional (older saves lack it); when present it must be a string.
  if (value.title !== undefined && typeof value.title !== 'string')
    return false;
  if (!Array.isArray(value.people) || !value.people.every(isPerson)) {
    return false;
  }
  if (!isRecord(value.assignments)) return false;
  return Object.values(value.assignments).every(isAssignment);
}

/** Serialize a schedule for storage. */
export function serializeSchedule(schedule: Schedule): string {
  return JSON.stringify(schedule);
}

/**
 * Parse a stored string into a `Schedule`, or `null` if it is missing, not
 * JSON, or not a valid schedule. Never throws — callers fall back to a fresh
 * schedule.
 */
export function deserializeSchedule(raw: string | null): Schedule | null {
  if (raw == null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return isValidSchedule(parsed) ? parsed : null;
}
