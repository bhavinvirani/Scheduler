import type { Rule, RuleScope } from '../types.ts';

/** localStorage key. Namespaced + versioned, independent of the schedule + presets. */
export const RULES_STORAGE_KEY = 'shift-scheduler:v1:rules';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A finite number within an inclusive range. */
function isNumberInRange(value: unknown, min: number, max: number): boolean {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}

function isValidScope(value: unknown): value is RuleScope {
  if (!isRecord(value)) return false;
  if (value.kind === 'all') return true;
  return (
    value.kind === 'people' &&
    Array.isArray(value.ids) &&
    value.ids.every((id) => typeof id === 'string')
  );
}

/**
 * A stored rule is untrusted (hand-edited or from an older version), so every
 * field is validated before it is trusted — a corrupt rule must never reach the
 * engine or white-screen the app. Bounds are generous but keep values sane.
 */
export function isValidRule(value: unknown): value is Rule {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || typeof value.enabled !== 'boolean') {
    return false;
  }
  switch (value.type) {
    case 'coverageMin':
      return (
        isNumberInRange(value.minPeople, 1, 99) &&
        (value.days === 'all' ||
          value.days === 'weekdays' ||
          value.days === 'weekends')
      );
    case 'restHours':
      return (
        isNumberInRange(value.minHours, 0, 48) && isValidScope(value.scope)
      );
    case 'weeklyHoursMax':
      return (
        isNumberInRange(value.maxHours, 0, 168) && isValidScope(value.scope)
      );
    case 'weeklyHoursMin':
      return (
        isNumberInRange(value.minHours, 0, 168) && isValidScope(value.scope)
      );
    case 'consecutiveDaysMax':
      return isNumberInRange(value.maxDays, 1, 14) && isValidScope(value.scope);
    case 'shiftsPerWeekMax':
      return (
        isNumberInRange(value.maxShifts, 0, 7) && isValidScope(value.scope)
      );
    case 'daysOffPerWeekMin':
      return isNumberInRange(value.minDays, 0, 7) && isValidScope(value.scope);
    default:
      return false;
  }
}

export function serializeRules(rules: Rule[]): string {
  return JSON.stringify(rules);
}

/**
 * Parse stored rules, or `null` if missing/corrupt so the caller can fall back
 * to the defaults. An empty array is valid (the user may have removed them all).
 * Never throws.
 */
export function deserializeRules(raw: string | null): Rule[] | null {
  if (raw == null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return parsed.every(isValidRule) ? (parsed as Rule[]) : null;
}
