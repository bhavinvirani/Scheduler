import { describe, it, expect } from 'vitest';
import type { Schedule } from '../types.ts';
import {
  STORAGE_KEY,
  isValidSchedule,
  deserializeSchedule,
  serializeSchedule,
} from './scheduleStorage.ts';

const VALID: Schedule = {
  version: 1,
  startDate: '2026-07-27',
  weekCount: 2,
  people: [
    { id: 'p1', name: 'Ada' },
    { id: 'p2', name: '' },
  ],
  assignments: {
    'p1:0': { kind: 'shift', start: 1380, duration: 480 },
    'p1:1': { kind: 'off' },
    'p2:3': { kind: 'pto' },
    'p2:7': { kind: 'holiday' },
  },
};

describe('STORAGE_KEY', () => {
  it('is namespaced and versioned', () => {
    expect(STORAGE_KEY).toBe('shift-scheduler:v1:current');
  });
});

describe('serializeSchedule / deserializeSchedule', () => {
  it('round-trips a valid schedule', () => {
    expect(deserializeSchedule(serializeSchedule(VALID))).toEqual(VALID);
  });
});

describe('deserializeSchedule — the guarded load', () => {
  it('returns null for nothing stored', () => {
    expect(deserializeSchedule(null)).toBeNull();
  });

  it('returns null for non-JSON garbage instead of throwing', () => {
    expect(deserializeSchedule('}{ not json')).toBeNull();
  });

  it('returns null for JSON that is not a schedule shape', () => {
    expect(deserializeSchedule('[1,2,3]')).toBeNull();
    expect(deserializeSchedule('"a string"')).toBeNull();
    expect(deserializeSchedule('null')).toBeNull();
  });

  it('parses a well-formed stored schedule', () => {
    expect(deserializeSchedule(JSON.stringify(VALID))).toEqual(VALID);
  });
});

describe('isValidSchedule — untrusted input', () => {
  it('accepts a schedule using every assignment kind', () => {
    expect(isValidSchedule(VALID)).toBe(true);
  });

  it('rejects a mismatched schema version', () => {
    expect(isValidSchedule({ ...VALID, version: 2 })).toBe(false);
    expect(isValidSchedule({ ...VALID, version: 0 })).toBe(false);
  });

  it('rejects an out-of-range week count', () => {
    expect(isValidSchedule({ ...VALID, weekCount: 3 })).toBe(false);
    expect(isValidSchedule({ ...VALID, weekCount: 0 })).toBe(false);
  });

  it('rejects a malformed start date', () => {
    expect(isValidSchedule({ ...VALID, startDate: 'July 27' })).toBe(false);
    expect(isValidSchedule({ ...VALID, startDate: 20260727 })).toBe(false);
  });

  it('rejects a well-shaped but impossible start date', () => {
    expect(isValidSchedule({ ...VALID, startDate: '2026-02-30' })).toBe(false);
    expect(isValidSchedule({ ...VALID, startDate: '2026-13-01' })).toBe(false);
  });

  it('rejects people that are not {id, name}', () => {
    expect(isValidSchedule({ ...VALID, people: 'nope' })).toBe(false);
    expect(isValidSchedule({ ...VALID, people: [{ id: 'x' }] })).toBe(false);
    expect(isValidSchedule({ ...VALID, people: [{ name: 'x' }] })).toBe(false);
  });

  it('rejects an assignments value that is not a valid assignment', () => {
    expect(
      isValidSchedule({ ...VALID, assignments: { 'p1:0': { kind: 'lunch' } } }),
    ).toBe(false);
    expect(
      isValidSchedule({
        ...VALID,
        assignments: { 'p1:0': { kind: 'shift', start: 60 } }, // missing duration
      }),
    ).toBe(false);
    expect(
      isValidSchedule({
        ...VALID,
        assignments: { 'p1:0': { kind: 'shift', start: 'x', duration: 1 } },
      }),
    ).toBe(false);
  });

  it('rejects primitives, arrays, and null', () => {
    expect(isValidSchedule(null)).toBe(false);
    expect(isValidSchedule(42)).toBe(false);
    expect(isValidSchedule('schedule')).toBe(false);
    expect(isValidSchedule([VALID])).toBe(false);
  });
});
