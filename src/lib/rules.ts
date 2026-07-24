import type {
  CellKey,
  Person,
  Rule,
  RuleScope,
  RuleType,
  Schedule,
} from '../types.ts';
import { DAYS_PER_WEEK, MINUTES_PER_DAY } from '../constants.ts';
import { cellKey, getAssignment } from '../state/scheduleReducer.ts';
import { summarizePerson, formatHours } from './hours.ts';
import { addDays, formatDayHeader } from './dates.ts';

/**
 * One broken rule, pinned to the exact cells/days it concerns so the UI can
 * highlight them and scroll to them. The engine is a pure
 * `(Schedule, Rule[]) => Violation[]` — no rendering, no dates beyond what the
 * schedule carries — so every rule's logic is unit-testable in isolation.
 */
export interface Violation {
  ruleId: string;
  ruleType: RuleType;
  /** Plain-language description shown in the warnings panel. */
  message: string;
  /** The person a per-person rule concerns; absent for team-wide coverage. */
  personId?: string;
  /** Day indices (0..13) implicated, for marking day headers. */
  dayIndices: number[];
  /** Cells to ring with `--alert` and scroll to. Empty for coverage (a day, not a cell). */
  cellKeys: CellKey[];
}

// --- shared helpers -------------------------------------------------------

/** A person's display name, never blank in a message. */
function nameOf(person: Person): string {
  return person.name.trim() || 'Unnamed';
}

/** `Sat Jul 25` — a compact day reference built from the schedule's start date. */
function dayLabel(schedule: Schedule, dayIndex: number): string {
  const header = formatDayHeader(addDays(schedule.startDate, dayIndex));
  return `${header.weekday.slice(0, 3)} ${header.date}`;
}

/** Weekday of a day index, 0 = Monday … 6 = Sunday (the week starts Monday). */
function weekdayOf(dayIndex: number): number {
  return dayIndex % DAYS_PER_WEEK;
}

/** The people a rule applies to: everyone, or just those named in a people-scope. */
function peopleInScope(schedule: Schedule, scope: RuleScope): Person[] {
  if (scope.kind === 'all') return schedule.people;
  const ids = new Set(scope.ids);
  return schedule.people.filter((person) => ids.has(person.id));
}

/** True when the person works a shift on that day (off/PTO/holiday/empty do not). */
function worksShift(
  schedule: Schedule,
  personId: string,
  dayIndex: number,
): boolean {
  return getAssignment(schedule, personId, dayIndex).kind === 'shift';
}

/** The shift-worked day indices for a person within one week (0-based week). */
function shiftDaysInWeek(
  schedule: Schedule,
  personId: string,
  week: number,
): number[] {
  const days: number[] = [];
  const base = week * DAYS_PER_WEEK;
  for (let offset = 0; offset < DAYS_PER_WEEK; offset++) {
    if (worksShift(schedule, personId, base + offset)) days.push(base + offset);
  }
  return days;
}

// --- per-rule evaluators --------------------------------------------------

type Evaluator<R extends Rule> = (schedule: Schedule, rule: R) => Violation[];

const coverageMin: Evaluator<Extract<Rule, { type: 'coverageMin' }>> = (
  schedule,
  rule,
) => {
  const activeDays = schedule.weekCount * DAYS_PER_WEEK;
  const violations: Violation[] = [];
  for (let day = 0; day < activeDays; day++) {
    const weekday = weekdayOf(day);
    const inScope =
      rule.days === 'all' ||
      (rule.days === 'weekdays' && weekday <= 4) ||
      (rule.days === 'weekends' && weekday >= 5);
    if (!inScope) continue;

    const working = schedule.people.filter((person) =>
      worksShift(schedule, person.id, day),
    ).length;
    if (working < rule.minPeople) {
      violations.push({
        ruleId: rule.id,
        ruleType: rule.type,
        message: `${dayLabel(schedule, day)}: ${working} working (need ${rule.minPeople})`,
        dayIndices: [day],
        cellKeys: [],
      });
    }
  }
  return violations;
};

const restHours: Evaluator<Extract<Rule, { type: 'restHours' }>> = (
  schedule,
  rule,
) => {
  const activeDays = schedule.weekCount * DAYS_PER_WEEK;
  const minMinutes = rule.minHours * 60;
  const violations: Violation[] = [];

  for (const person of peopleInScope(schedule, rule.scope)) {
    for (let day = 0; day < activeDays - 1; day++) {
      const first = getAssignment(schedule, person.id, day);
      const next = getAssignment(schedule, person.id, day + 1);
      if (first.kind !== 'shift' || next.kind !== 'shift') continue;

      // End of day `day`'s shift to start of the next, measured across midnight.
      const restMinutes =
        MINUTES_PER_DAY + next.start - (first.start + first.duration);
      if (restMinutes < minMinutes) {
        const between = `${dayLabel(schedule, day)} and ${dayLabel(schedule, day + 1)}`;
        const detail =
          restMinutes < 0
            ? `shifts on ${between} overlap`
            : `only ${formatHours(restMinutes)} rest between ${between}`;
        violations.push({
          ruleId: rule.id,
          ruleType: rule.type,
          message: `${nameOf(person)}: ${detail} (need ${rule.minHours}h)`,
          personId: person.id,
          dayIndices: [day, day + 1],
          cellKeys: [cellKey(person.id, day), cellKey(person.id, day + 1)],
        });
      }
    }
  }
  return violations;
};

const weeklyHoursMax: Evaluator<Extract<Rule, { type: 'weeklyHoursMax' }>> = (
  schedule,
  rule,
) => {
  const maxMinutes = rule.maxHours * 60;
  const violations: Violation[] = [];
  for (const person of peopleInScope(schedule, rule.scope)) {
    const { weekMinutes } = summarizePerson(schedule, person.id);
    weekMinutes.forEach((minutes, week) => {
      if (minutes > maxMinutes) {
        const days = shiftDaysInWeek(schedule, person.id, week);
        violations.push({
          ruleId: rule.id,
          ruleType: rule.type,
          message: `${nameOf(person)}: week ${week + 1} is ${formatHours(minutes)} (over ${rule.maxHours}h)`,
          personId: person.id,
          dayIndices: days,
          cellKeys: days.map((day) => cellKey(person.id, day)),
        });
      }
    });
  }
  return violations;
};

const weeklyHoursMin: Evaluator<Extract<Rule, { type: 'weeklyHoursMin' }>> = (
  schedule,
  rule,
) => {
  const minMinutes = rule.minHours * 60;
  const violations: Violation[] = [];
  for (const person of peopleInScope(schedule, rule.scope)) {
    const { weekMinutes } = summarizePerson(schedule, person.id);
    weekMinutes.forEach((minutes, week) => {
      if (minutes < minMinutes) {
        const days = shiftDaysInWeek(schedule, person.id, week);
        violations.push({
          ruleId: rule.id,
          ruleType: rule.type,
          message: `${nameOf(person)}: week ${week + 1} is ${formatHours(minutes)} (under ${rule.minHours}h)`,
          personId: person.id,
          dayIndices: days,
          cellKeys: days.map((day) => cellKey(person.id, day)),
        });
      }
    });
  }
  return violations;
};

const consecutiveDaysMax: Evaluator<
  Extract<Rule, { type: 'consecutiveDaysMax' }>
> = (schedule, rule) => {
  const activeDays = schedule.weekCount * DAYS_PER_WEEK;
  const violations: Violation[] = [];

  for (const person of peopleInScope(schedule, rule.scope)) {
    let runStart = -1;
    // Walk one past the end with a sentinel so a run ending on the last day closes.
    for (let day = 0; day <= activeDays; day++) {
      const working = day < activeDays && worksShift(schedule, person.id, day);
      if (working && runStart === -1) {
        runStart = day;
      } else if (!working && runStart !== -1) {
        const runLength = day - runStart;
        if (runLength > rule.maxDays) {
          const days = Array.from(
            { length: runLength },
            (_, i) => runStart + i,
          );
          violations.push({
            ruleId: rule.id,
            ruleType: rule.type,
            message: `${nameOf(person)}: ${runLength} days in a row (${dayLabel(schedule, runStart)} to ${dayLabel(schedule, day - 1)}), max ${rule.maxDays}`,
            personId: person.id,
            dayIndices: days,
            cellKeys: days.map((d) => cellKey(person.id, d)),
          });
        }
        runStart = -1;
      }
    }
  }
  return violations;
};

const shiftsPerWeekMax: Evaluator<
  Extract<Rule, { type: 'shiftsPerWeekMax' }>
> = (schedule, rule) => {
  const violations: Violation[] = [];
  for (const person of peopleInScope(schedule, rule.scope)) {
    for (let week = 0; week < schedule.weekCount; week++) {
      const days = shiftDaysInWeek(schedule, person.id, week);
      if (days.length > rule.maxShifts) {
        violations.push({
          ruleId: rule.id,
          ruleType: rule.type,
          message: `${nameOf(person)}: week ${week + 1} has ${days.length} shifts (max ${rule.maxShifts})`,
          personId: person.id,
          dayIndices: days,
          cellKeys: days.map((day) => cellKey(person.id, day)),
        });
      }
    }
  }
  return violations;
};

const daysOffPerWeekMin: Evaluator<
  Extract<Rule, { type: 'daysOffPerWeekMin' }>
> = (schedule, rule) => {
  const violations: Violation[] = [];
  for (const person of peopleInScope(schedule, rule.scope)) {
    for (let week = 0; week < schedule.weekCount; week++) {
      const days = shiftDaysInWeek(schedule, person.id, week);
      const offDays = DAYS_PER_WEEK - days.length;
      if (offDays < rule.minDays) {
        violations.push({
          ruleId: rule.id,
          ruleType: rule.type,
          message: `${nameOf(person)}: week ${week + 1} has ${offDays} day${offDays === 1 ? '' : 's'} off (need ${rule.minDays})`,
          personId: person.id,
          dayIndices: days,
          cellKeys: days.map((day) => cellKey(person.id, day)),
        });
      }
    }
  }
  return violations;
};

/**
 * Dispatch one rule to its evaluator. The exhaustive switch means adding a rule
 * type to the union without an evaluator is a compile error, not a silent miss.
 */
function evaluateRule(schedule: Schedule, rule: Rule): Violation[] {
  switch (rule.type) {
    case 'coverageMin':
      return coverageMin(schedule, rule);
    case 'restHours':
      return restHours(schedule, rule);
    case 'weeklyHoursMax':
      return weeklyHoursMax(schedule, rule);
    case 'weeklyHoursMin':
      return weeklyHoursMin(schedule, rule);
    case 'consecutiveDaysMax':
      return consecutiveDaysMax(schedule, rule);
    case 'shiftsPerWeekMax':
      return shiftsPerWeekMax(schedule, rule);
    case 'daysOffPerWeekMin':
      return daysOffPerWeekMin(schedule, rule);
  }
}

/**
 * Evaluate every enabled rule against the schedule, in rule order. Pure and
 * side-effect free, so the same inputs always give the same violations —
 * ideal for a `useMemo` in the render path.
 */
export function evaluateRules(schedule: Schedule, rules: Rule[]): Violation[] {
  const violations: Violation[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    violations.push(...evaluateRule(schedule, rule));
  }
  return violations;
}
