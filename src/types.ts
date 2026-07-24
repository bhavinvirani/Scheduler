/**
 * Core data model. The shapes here are chosen so that illegal states are
 * unrepresentable — see PLAN.md §2 and §3 for the reasoning behind each choice.
 */

/** Minutes from local midnight. 0 = 00:00, 450 = 07:30, 1380 = 23:00. */
export type Minutes = number;

/**
 * What a single person is doing on a single day.
 *
 * A shift is stored as `{ start, duration }`, never `{ start, end }`: an
 * overnight shift (23:00 → 07:00) has an end time that reads as "before" its
 * start, so an end-time representation cannot tell an 8-hour night shift apart
 * from a fat-fingered backwards entry. Storing a duration makes that ambiguity
 * impossible to express, and every hours/rest calculation falls out for free.
 */
export type Assignment =
  | { kind: 'empty' }
  | { kind: 'off' }
  | { kind: 'pto' }
  | { kind: 'holiday' }
  | { kind: 'shift'; start: Minutes; duration: Minutes };

/** The kinds an Assignment can take — handy for exhaustive switches and UI. */
export type AssignmentKind = Assignment['kind'];

export interface Person {
  /** crypto.randomUUID(). Stable across reorder and rename — never the array index. */
  id: string;
  name: string;
}

/** `${personId}:${dayIndex}` where dayIndex is 0..13 (day 0 = week 1 Monday). */
export type CellKey = string;

/**
 * A reusable, named shift template for one-tap fill. Stored as the same
 * `{ start, duration }` a real shift uses, so applying a preset is just a
 * `SET_ASSIGNMENT` with `{ kind: 'shift', ... }` — no new shift representation.
 * Presets live outside the schedule (their own store) so the library survives
 * across schedules, Clear, and Undo.
 */
export interface ShiftPreset {
  /** crypto.randomUUID(). Stable identity — never the array index. */
  id: string;
  /** Display name, e.g. "Day". May be empty; the UI falls back to the time range. */
  name: string;
  start: Minutes;
  duration: Minutes;
}

/**
 * A scheduling rule the user turns on and configures. Rules are user-defined
 * (a catalog of parameterized types, not hardcoded thresholds) and live in their
 * own store, like presets — so they persist across schedules and never touch the
 * schedule's undo history. The pure engine in `lib/rules.ts` turns a schedule +
 * these rules into a list of `Violation`s the UI surfaces with the reserved
 * `--alert` channel.
 */
export type RuleType =
  | 'coverageMin'
  | 'restHours'
  | 'weeklyHoursMax'
  | 'weeklyHoursMin'
  | 'consecutiveDaysMax'
  | 'shiftsPerWeekMax'
  | 'daysOffPerWeekMin';

/** Which calendar days a coverage rule applies to. */
export type CoverageDays = 'all' | 'weekdays' | 'weekends';

/**
 * Who a per-person rule checks: everyone, or a chosen set of people (by UUID —
 * never the array index). A person removed from the roster simply stops matching.
 */
export type RuleScope = { kind: 'all' } | { kind: 'people'; ids: string[] };

interface RuleCommon {
  /** crypto.randomUUID(). Stable identity — never the array index. */
  id: string;
  /** A disabled rule stays in the library but is skipped by the engine. */
  enabled: boolean;
}

export type Rule =
  | (RuleCommon & {
      type: 'coverageMin';
      minPeople: number;
      days: CoverageDays;
    })
  | (RuleCommon & { type: 'restHours'; minHours: number; scope: RuleScope })
  | (RuleCommon & {
      type: 'weeklyHoursMax';
      maxHours: number;
      scope: RuleScope;
    })
  | (RuleCommon & {
      type: 'weeklyHoursMin';
      minHours: number;
      scope: RuleScope;
    })
  | (RuleCommon & {
      type: 'consecutiveDaysMax';
      maxDays: number;
      scope: RuleScope;
    })
  | (RuleCommon & {
      type: 'shiftsPerWeekMax';
      maxShifts: number;
      scope: RuleScope;
    })
  | (RuleCommon & {
      type: 'daysOffPerWeekMin';
      minDays: number;
      scope: RuleScope;
    });

export interface Schedule {
  /** Schema version. Bump on any breaking change; migrate on load. */
  version: 1;
  /** ISO date (YYYY-MM-DD). Always a Monday. A calendar date, never an instant. */
  startDate: string;
  weekCount: 1 | 2;
  people: Person[];
  assignments: Record<CellKey, Assignment>;
  /**
   * Optional document title shown at the top of the printed schedule and used
   * as the PDF's title. Empty/absent falls back to a default. Optional so older
   * saved schedules (which never had it) still load.
   */
  title?: string;
}
