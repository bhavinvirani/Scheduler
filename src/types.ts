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

export interface Schedule {
  /** Schema version. Bump on any breaking change; migrate on load. */
  version: 1;
  /** ISO date (YYYY-MM-DD). Always a Monday. A calendar date, never an instant. */
  startDate: string;
  weekCount: 1 | 2;
  people: Person[];
  assignments: Record<CellKey, Assignment>;
}
