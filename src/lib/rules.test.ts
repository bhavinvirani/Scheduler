import { describe, it, expect } from 'vitest';
import type {
  Assignment,
  Person,
  Rule,
  RuleScope,
  Schedule,
} from '../types.ts';
import { cellKey } from '../state/scheduleReducer.ts';
import { evaluateRules } from './rules.ts';

// --- builders -------------------------------------------------------------

const shift = (startHour: number, hours = 8): Assignment => ({
  kind: 'shift',
  start: startHour * 60,
  duration: hours * 60,
});
const OFF: Assignment = { kind: 'off' };
const PTO: Assignment = { kind: 'pto' };

let idCounter = 0;
function person(name: string): Person {
  idCounter += 1;
  return { id: `person-${idCounter}`, name };
}

/** Build a schedule from people and a `${personId}:${dayIndex}` assignment map. */
function makeSchedule(
  people: Person[],
  assignments: Record<string, Assignment>,
  weekCount: 1 | 2 = 2,
): Schedule {
  return {
    version: 1,
    startDate: '2026-07-20', // a Monday; irrelevant to the pure engine
    weekCount,
    people,
    assignments,
  };
}

/** Assign one person a 14-slot pattern of assignments (index = dayIndex). */
function row(
  p: Person,
  pattern: Array<Assignment | null>,
): Record<string, Assignment> {
  const out: Record<string, Assignment> = {};
  pattern.forEach((a, day) => {
    if (a) out[cellKey(p.id, day)] = a;
  });
  return out;
}

const allScope = { kind: 'all' } as const;

// --- disabled -------------------------------------------------------------

describe('evaluateRules — enable flag', () => {
  it('ignores a disabled rule entirely', () => {
    const p = person('Ada');
    const schedule = makeSchedule([p], row(p, [shift(23), shift(6)]));
    const rule: Rule = {
      id: 'r1',
      type: 'restHours',
      enabled: false,
      minHours: 11,
      scope: allScope,
    };
    expect(evaluateRules(schedule, [rule])).toEqual([]);
  });
});

// --- coverageMin ----------------------------------------------------------

describe('coverageMin', () => {
  const rule = (
    minPeople: number,
    days: 'all' | 'weekdays' | 'weekends' = 'all',
  ): Rule => ({
    id: 'cov',
    type: 'coverageMin',
    enabled: true,
    minPeople,
    days,
  });

  it('flags a day with fewer people working than the minimum', () => {
    const a = person('A');
    const b = person('B');
    // Everyone works every day of the week, except: day 3 only A, day 5 nobody.
    const aPattern: Array<Assignment | null> = Array(7).fill(shift(9));
    const bPattern: Array<Assignment | null> = Array(7).fill(shift(9));
    bPattern[3] = OFF; // day 3: only A works
    aPattern[5] = OFF;
    bPattern[5] = OFF; // day 5: nobody works
    const schedule = makeSchedule(
      [a, b],
      { ...row(a, aPattern), ...row(b, bPattern) },
      1,
    );
    const violations = evaluateRules(schedule, [rule(2)]);
    expect(violations.map((v) => v.dayIndices[0])).toEqual([3, 5]);
    expect(violations[0]!.ruleType).toBe('coverageMin');
  });

  it('counts only shifts, not off/PTO/holiday', () => {
    const a = person('A');
    const b = person('B');
    // Both work every day except day 0, where they are merely off/PTO — which
    // must not count as coverage, so day 0 (and only day 0) falls below 1.
    const aPattern: Array<Assignment | null> = Array(7).fill(shift(9));
    const bPattern: Array<Assignment | null> = Array(7).fill(shift(9));
    aPattern[0] = OFF;
    bPattern[0] = PTO;
    const schedule = makeSchedule(
      [a, b],
      { ...row(a, aPattern), ...row(b, bPattern) },
      1,
    );
    const violations = evaluateRules(schedule, [rule(1)]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.dayIndices).toEqual([0]);
  });

  it('respects the weekdays / weekends scope', () => {
    const a = person('A');
    // Nobody works at all across week 1 (days 0..6): 0 < 1 everywhere.
    const schedule = makeSchedule([a], {}, 1);
    const weekdays = evaluateRules(schedule, [rule(1, 'weekdays')]);
    const weekends = evaluateRules(schedule, [rule(1, 'weekends')]);
    expect(weekdays.map((v) => v.dayIndices[0])).toEqual([0, 1, 2, 3, 4]);
    expect(weekends.map((v) => v.dayIndices[0])).toEqual([5, 6]);
  });

  it('ignores days beyond the active week count', () => {
    const a = person('A');
    // A one-week schedule: only days 0..6 are checked even if day 7 has data.
    const schedule = makeSchedule([a], row(a, Array(14).fill(shift(9))), 1);
    const violations = evaluateRules(schedule, [rule(1)]);
    expect(violations).toEqual([]); // A works every active day
  });
});

// --- restHours ------------------------------------------------------------

describe('restHours', () => {
  const rule = (minHours: number, scope: RuleScope = allScope): Rule => ({
    id: 'rest',
    type: 'restHours',
    enabled: true,
    minHours,
    scope,
  });

  it('flags too little rest between two consecutive shifts', () => {
    const a = person('Ada');
    // Evening (15:00-23:00) then next-day Day (07:00-15:00): 8h rest.
    const schedule = makeSchedule([a], row(a, [shift(15), shift(7)]));
    const violations = evaluateRules(schedule, [rule(11)]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.personId).toBe(a.id);
    expect(violations[0]!.dayIndices).toEqual([0, 1]);
    expect(violations[0]!.cellKeys).toEqual([
      cellKey(a.id, 0),
      cellKey(a.id, 1),
    ]);
  });

  it('computes rest across midnight for an overnight shift', () => {
    const a = person('Ada');
    // Night 23:00-07:00 then a 07:00 start = exactly 0h rest.
    const schedule = makeSchedule([a], row(a, [shift(23), shift(7)]));
    expect(evaluateRules(schedule, [rule(11)])).toHaveLength(1);
    // With a 0h minimum nothing is flagged (0 is not < 0).
    expect(evaluateRules(schedule, [rule(0)])).toEqual([]);
  });

  it('does not flag when rest meets the minimum exactly', () => {
    const a = person('Ada');
    // Day (07:00-15:00) then next Day (07:00): 16h rest, min 16h -> ok.
    const schedule = makeSchedule([a], row(a, [shift(7), shift(7)]));
    expect(evaluateRules(schedule, [rule(16)])).toEqual([]);
  });

  it('does not span a non-working day', () => {
    const a = person('Ada');
    // Shift, off, shift: the two shifts are not consecutive, so no rest check.
    const schedule = makeSchedule([a], row(a, [shift(23), OFF, shift(6)]));
    expect(evaluateRules(schedule, [rule(11)])).toEqual([]);
  });

  it('checks the pair that straddles the week boundary (day 6 -> 7)', () => {
    const a = person('Ada');
    const pattern: Array<Assignment | null> = Array(14).fill(null);
    pattern[6] = shift(15); // Sun week 1 evening
    pattern[7] = shift(7); // Mon week 2 day -> 8h rest
    const schedule = makeSchedule([a], row(a, pattern));
    const violations = evaluateRules(schedule, [rule(11)]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.dayIndices).toEqual([6, 7]);
  });

  it('only checks people named in a people-scope', () => {
    const a = person('Ada');
    const b = person('Ben');
    const short = [shift(15), shift(7)]; // 8h rest for whoever gets it
    const schedule = makeSchedule([a, b], {
      ...row(a, short),
      ...row(b, short),
    });
    const scoped = rule(11, { kind: 'people', ids: [b.id] });
    const violations = evaluateRules(schedule, [scoped]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.personId).toBe(b.id);
  });
});

// --- weeklyHoursMax / weeklyHoursMin -------------------------------------

describe('weeklyHours caps', () => {
  it('flags a week over the max, per week, not the fortnight total', () => {
    const a = person('Ada');
    // Week 1: 5 x 8h = 40h. Week 2: 4 x 8h = 32h.
    const pattern: Array<Assignment | null> = Array(14).fill(null);
    for (let d = 0; d < 5; d++) pattern[d] = shift(9);
    for (let d = 7; d < 11; d++) pattern[d] = shift(9);
    const schedule = makeSchedule([a], row(a, pattern));
    const rule: Rule = {
      id: 'max',
      type: 'weeklyHoursMax',
      enabled: true,
      maxHours: 35,
      scope: { kind: 'all' },
    };
    const violations = evaluateRules(schedule, [rule]);
    // Only week 1 (40h) exceeds 35h; week 2 (32h) is fine.
    expect(violations).toHaveLength(1);
    expect(violations[0]!.ruleType).toBe('weeklyHoursMax');
    expect(violations[0]!.personId).toBe(a.id);
  });

  it('treats the max as inclusive (exactly at the cap is fine)', () => {
    const a = person('Ada');
    const pattern: Array<Assignment | null> = Array(14).fill(null);
    for (let d = 0; d < 5; d++) pattern[d] = shift(9); // 40h week 1
    const schedule = makeSchedule([a], row(a, pattern));
    const rule: Rule = {
      id: 'max',
      type: 'weeklyHoursMax',
      enabled: true,
      maxHours: 40,
      scope: { kind: 'all' },
    };
    expect(evaluateRules(schedule, [rule])).toEqual([]);
  });

  it('flags a week under the minimum', () => {
    const a = person('Ada');
    const pattern: Array<Assignment | null> = Array(14).fill(null);
    for (let d = 0; d < 4; d++) pattern[d] = shift(9); // 32h week 1
    for (let d = 7; d < 12; d++) pattern[d] = shift(9); // 40h week 2
    const schedule = makeSchedule([a], row(a, pattern));
    const rule: Rule = {
      id: 'min',
      type: 'weeklyHoursMin',
      enabled: true,
      minHours: 40,
      scope: { kind: 'all' },
    };
    const violations = evaluateRules(schedule, [rule]);
    expect(violations).toHaveLength(1); // week 1 only
    expect(violations[0]!.ruleType).toBe('weeklyHoursMin');
  });
});

// --- consecutiveDaysMax ---------------------------------------------------

describe('consecutiveDaysMax', () => {
  const rule = (maxDays: number): Rule => ({
    id: 'consec',
    type: 'consecutiveDaysMax',
    enabled: true,
    maxDays,
    scope: { kind: 'all' },
  });

  it('flags a run longer than the max and reports its days', () => {
    const a = person('Ada');
    // 5 worked in a row (days 0..4), then off.
    const pattern: Array<Assignment | null> = Array(14).fill(null);
    for (let d = 0; d < 5; d++) pattern[d] = shift(9);
    const schedule = makeSchedule([a], row(a, pattern));
    const violations = evaluateRules(schedule, [rule(4)]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.dayIndices).toEqual([0, 1, 2, 3, 4]);
  });

  it('a non-working day breaks the run', () => {
    const a = person('Ada');
    // 3 on, off, 3 on: longest run is 3, so max 4 is fine.
    const pattern: Array<Assignment | null> = [
      shift(9),
      shift(9),
      shift(9),
      OFF,
      shift(9),
      shift(9),
      shift(9),
    ];
    const schedule = makeSchedule([a], row(a, pattern), 1);
    expect(evaluateRules(schedule, [rule(4)])).toEqual([]);
  });

  it('counts a run that crosses the week boundary', () => {
    const a = person('Ada');
    const pattern: Array<Assignment | null> = Array(14).fill(null);
    for (let d = 4; d < 10; d++) pattern[d] = shift(9); // 6 in a row across weeks
    const schedule = makeSchedule([a], row(a, pattern));
    const violations = evaluateRules(schedule, [rule(5)]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.dayIndices).toEqual([4, 5, 6, 7, 8, 9]);
  });
});

// --- shiftsPerWeekMax / daysOffPerWeekMin --------------------------------

describe('shiftsPerWeekMax and daysOffPerWeekMin', () => {
  it('flags a week with too many shifts', () => {
    const a = person('Ada');
    const pattern: Array<Assignment | null> = Array(14).fill(null);
    for (let d = 0; d < 6; d++) pattern[d] = shift(9); // 6 shifts week 1
    const schedule = makeSchedule([a], row(a, pattern));
    const rule: Rule = {
      id: 's',
      type: 'shiftsPerWeekMax',
      enabled: true,
      maxShifts: 5,
      scope: { kind: 'all' },
    };
    const violations = evaluateRules(schedule, [rule]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.ruleType).toBe('shiftsPerWeekMax');
  });

  it('flags a week with too few days off', () => {
    const a = person('Ada');
    const pattern: Array<Assignment | null> = Array(14).fill(null);
    for (let d = 0; d < 6; d++) pattern[d] = shift(9); // 6 worked -> 1 day off
    const schedule = makeSchedule([a], row(a, pattern), 1);
    const rule: Rule = {
      id: 'd',
      type: 'daysOffPerWeekMin',
      enabled: true,
      minDays: 2,
      scope: { kind: 'all' },
    };
    const violations = evaluateRules(schedule, [rule]);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.ruleType).toBe('daysOffPerWeekMin');
  });
});

// --- composition ----------------------------------------------------------

describe('evaluateRules — multiple rules', () => {
  it('returns violations from every enabled rule, rules in order', () => {
    const a = person('Ada');
    const schedule = makeSchedule([a], row(a, [shift(15), shift(7)]), 1);
    const rules: Rule[] = [
      {
        id: 'r1',
        type: 'restHours',
        enabled: true,
        minHours: 11,
        scope: allScope,
      },
      {
        id: 'r2',
        type: 'daysOffPerWeekMin',
        enabled: true,
        minDays: 6,
        scope: allScope,
      },
    ];
    const violations = evaluateRules(schedule, rules);
    expect(violations.map((v) => v.ruleId)).toEqual(['r1', 'r2']);
  });

  it('returns nothing when there are no rules', () => {
    const a = person('Ada');
    const schedule = makeSchedule([a], row(a, [shift(9)]));
    expect(evaluateRules(schedule, [])).toEqual([]);
  });
});
