import { describe, it, expect } from 'vitest';
import type { Assignment, Schedule } from '../types.ts';
import { cellKey, getAssignment } from '../state/scheduleReducer.ts';
import { DAYS_PER_WEEK } from '../constants.ts';
import { decodeShare, encodeShare } from './shareCodec.ts';

const SHIFT: Assignment = { kind: 'shift', start: 420, duration: 480 };
const NIGHT: Assignment = { kind: 'shift', start: 1380, duration: 480 };

function make(
  people: { id: string; name: string }[],
  byPersonDay: Record<string, Assignment>,
  extra: Partial<Schedule> = {},
): Schedule {
  return {
    version: 1,
    startDate: '2026-07-20',
    weekCount: 2,
    people,
    assignments: byPersonDay,
    ...extra,
  };
}

/**
 * Normalize to a shape that ignores person ids (which are regenerated on decode)
 * but preserves people order, names, dates, title, and each person's day cells.
 */
function normalize(schedule: Schedule) {
  const days = schedule.weekCount * DAYS_PER_WEEK;
  return {
    startDate: schedule.startDate,
    weekCount: schedule.weekCount,
    title: schedule.title,
    people: schedule.people.map((person) => ({
      name: person.name,
      days: Array.from({ length: days }, (_, d) =>
        getAssignment(schedule, person.id, d),
      ),
    })),
  };
}

function roundTrip(schedule: Schedule): Schedule {
  const decoded = decodeShare(encodeShare(schedule));
  if (!decoded) throw new Error('expected a valid decode');
  return decoded;
}

describe('shareCodec', () => {
  it('round-trips a schedule (ignoring regenerated ids)', () => {
    const schedule = make(
      [
        { id: 'a', name: 'Ada' },
        { id: 'b', name: 'Grace' },
      ],
      {
        [cellKey('a', 0)]: SHIFT,
        [cellKey('a', 5)]: { kind: 'off' },
        [cellKey('b', 1)]: { kind: 'pto' },
        [cellKey('b', 9)]: { kind: 'holiday' },
      },
      { title: 'Front Desk' },
    );
    expect(normalize(roundTrip(schedule))).toEqual(normalize(schedule));
  });

  it('gives decoded people fresh unique ids (never the encoded ones)', () => {
    const schedule = make([{ id: 'a', name: 'Ada' }], {
      [cellKey('a', 0)]: SHIFT,
    });
    const decoded = roundTrip(schedule);
    expect(decoded.people[0]?.id).not.toBe('a');
    expect(decoded.people[0]?.id).toMatch(/[0-9a-f-]{36}/);
    // Assignments must be re-keyed to the new id and still readable.
    expect(getAssignment(decoded, decoded.people[0]!.id, 0)).toEqual(SHIFT);
  });

  it('preserves an overnight shift', () => {
    const schedule = make([{ id: 'a', name: 'A' }], {
      [cellKey('a', 6)]: NIGHT,
    });
    const decoded = roundTrip(schedule);
    expect(getAssignment(decoded, decoded.people[0]!.id, 6)).toEqual(NIGHT);
  });

  it('survives Unicode names', () => {
    const schedule = make(
      [
        { id: 'a', name: 'José' },
        { id: 'b', name: '李雷' },
        { id: 'c', name: 'Zoë 🌙' },
      ],
      {},
    );
    expect(normalize(roundTrip(schedule)).people.map((p) => p.name)).toEqual([
      'José',
      '李雷',
      'Zoë 🌙',
    ]);
  });

  it('round-trips a one-week schedule with no assignments', () => {
    const schedule = make([{ id: 'a', name: 'A' }], {}, { weekCount: 1 });
    expect(normalize(roundTrip(schedule))).toEqual(normalize(schedule));
  });

  it('only encodes days within the active week count', () => {
    // A lingering week-2 assignment must not appear when weekCount is 1.
    const schedule = make(
      [{ id: 'a', name: 'A' }],
      { [cellKey('a', 0)]: SHIFT, [cellKey('a', 9)]: NIGHT },
      { weekCount: 1 },
    );
    const decoded = roundTrip(schedule);
    expect(getAssignment(decoded, decoded.people[0]!.id, 0)).toEqual(SHIFT);
    expect(getAssignment(decoded, decoded.people[0]!.id, 9)).toEqual({
      kind: 'empty',
    });
  });

  it('returns null for junk input', () => {
    expect(decodeShare('')).toBeNull();
    expect(decodeShare('not-base64-!!!')).toBeNull();
    expect(decodeShare(btoa('{"not":"a payload"}'))).toBeNull();
    expect(decodeShare(btoa('total garbage {'))).toBeNull();
  });

  it('rejects an invalid week count', () => {
    expect(decodeShare('1.3.20260720..')).toBeNull();
  });

  it('rejects a malformed or impossible date', () => {
    expect(decodeShare('1.2.20261340..')).toBeNull(); // month 13, day 40
    expect(decodeShare('1.2.badx..')).toBeNull();
  });

  it('keeps a shift on the very last day (no over-trim)', () => {
    const schedule = make([{ id: 'a', name: 'A' }], {
      [cellKey('a', 13)]: NIGHT,
    });
    const decoded = roundTrip(schedule);
    expect(getAssignment(decoded, decoded.people[0]!.id, 13)).toEqual(NIGHT);
  });

  it('produces a URL-safe string (no +, /, or = padding)', () => {
    const schedule = make([{ id: 'a', name: 'Ada Lovelace' }], {
      [cellKey('a', 0)]: SHIFT,
    });
    expect(encodeShare(schedule)).not.toMatch(/[+/=]/);
  });

  it('encodes a small roster into a short string', () => {
    const schedule = make(
      [
        { id: 'a', name: 'Ada' },
        { id: 'b', name: 'Lin' },
      ],
      {
        [cellKey('a', 0)]: SHIFT,
        [cellKey('a', 5)]: { kind: 'off' },
        [cellKey('b', 1)]: { kind: 'pto' },
      },
      { title: 'Front Desk' },
    );
    expect(encodeShare(schedule).length).toBeLessThan(80);
  });
});
