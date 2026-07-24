import type { ShiftPreset } from '../types.ts';
import {
  MINUTES_PER_DAY,
  SHIFT_DURATION_MAX_MINUTES,
  SHIFT_DURATION_MIN_MINUTES,
} from '../constants.ts';

/** localStorage key. Namespaced + versioned, independent of the schedule blob. */
export const PRESETS_STORAGE_KEY = 'shift-scheduler:v1:presets';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A stored preset is untrusted — validate every field before trusting it. */
export function isValidPreset(value: unknown): value is ShiftPreset {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') {
    return false;
  }
  if (
    typeof value.start !== 'number' ||
    !Number.isFinite(value.start) ||
    value.start < 0 ||
    value.start >= MINUTES_PER_DAY
  ) {
    return false;
  }
  return (
    typeof value.duration === 'number' &&
    Number.isFinite(value.duration) &&
    value.duration >= SHIFT_DURATION_MIN_MINUTES &&
    value.duration <= SHIFT_DURATION_MAX_MINUTES
  );
}

export function serializePresets(presets: ShiftPreset[]): string {
  return JSON.stringify(presets);
}

/**
 * Parse stored presets, or `null` if missing/corrupt so the caller can fall
 * back to the defaults. An empty array is valid — the user may have deleted
 * every preset on purpose. Never throws.
 */
export function deserializePresets(raw: string | null): ShiftPreset[] | null {
  if (raw == null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return parsed.every(isValidPreset) ? (parsed as ShiftPreset[]) : null;
}
