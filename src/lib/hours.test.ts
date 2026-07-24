import { describe, it, expect } from 'vitest';
import type { Assignment, Schedule } from '../types.ts';
import { summarizePerson, formatHours } from './hours.ts';

const SHIFT8: Assignment = { kind: 'shift', start: 420, duration: 480 }; // 8h
const NIGHT8: Assignment = { kind: 'shift', start: 1380, duration: 480 }; // overnight 8h

function make(weekCount: 1 | 2, byDay: Record<number, Assignment>): Schedule {
  const assignments: Record<string, Assignment> = {};
  for (const [day, value] of Object.entries(byDay)) {
    assignments[`p1:${day}`] = value;
  }
  return {
    version: 1,
    startDate: '2026-07-20',
    weekCount,
    people: [{ id: 'p1', name: 'A' }],
    assignments,
  };
}

describe('summarizePerson', () => {
  it('sums shift durations per week and tallies absence days', () => {
    const schedule = make(1, {
      0: SHIFT8,
      1: SHIFT8,
      2: SHIFT8,
      3: SHIFT8,
      4: SHIFT8, // 5 × 8h = 40h
      5: { kind: 'off' },
      6: { kind: 'pto' },
    });
    const summary = summarizePerson(schedule, 'p1');
    expect(summary.weekMinutes).toEqual([2400]); // 40h
    expect(summary.totalMinutes).toBe(2400);
    expect(summary.offDays).toBe(1);
    expect(summary.ptoDays).toBe(1);
    expect(summary.holidayDays).toBe(0);
  });

  it('reports one entry per active week and totals across them', () => {
    const schedule = make(2, {
      0: SHIFT8,
      1: SHIFT8, // week 1: 16h
      7: SHIFT8,
      8: SHIFT8,
      9: SHIFT8, // week 2: 24h
      10: { kind: 'holiday' },
    });
    const summary = summarizePerson(schedule, 'p1');
    expect(summary.weekMinutes).toEqual([960, 1440]); // 16h, 24h
    expect(summary.totalMinutes).toBe(2400); // 40h
    expect(summary.holidayDays).toBe(1);
  });

  it('counts an overnight shift in the week it starts', () => {
    // Day 6 is Sunday of week 1; the shift ends Monday morning but belongs to week 1.
    const schedule = make(2, { 6: NIGHT8 });
    const summary = summarizePerson(schedule, 'p1');
    expect(summary.weekMinutes).toEqual([480, 0]);
  });

  it('ignores days outside the active week count', () => {
    // weekCount 1 must not count week-2 assignments that still linger in the map.
    const schedule = make(1, { 0: SHIFT8, 7: SHIFT8 });
    const summary = summarizePerson(schedule, 'p1');
    expect(summary.weekMinutes).toEqual([480]);
    expect(summary.totalMinutes).toBe(480);
  });

  it('returns zeros for a person with no assignments', () => {
    const schedule = make(2, {});
    expect(summarizePerson(schedule, 'p1')).toEqual({
      weekMinutes: [0, 0],
      totalMinutes: 0,
      offDays: 0,
      ptoDays: 0,
      holidayDays: 0,
    });
  });
});

describe('formatHours', () => {
  it('renders minutes as one-decimal hours', () => {
    expect(formatHours(2400)).toBe('40.0h');
    expect(formatHours(480)).toBe('8.0h');
    expect(formatHours(510)).toBe('8.5h');
    expect(formatHours(0)).toBe('0.0h');
  });
});
