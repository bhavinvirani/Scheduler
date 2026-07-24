/**
 * Tunable constants. Everything the scheduling grid measures in time flows from
 * these — change the increment here and start/duration dropdowns follow.
 */

/** Minutes between selectable start times. 30 → …, 07:00, 07:30, 08:00, … */
export const TIME_INCREMENT_MINUTES = 30;

/** Shortest selectable shift length. */
export const SHIFT_DURATION_MIN_MINUTES = 60;

/** Longest selectable shift length. */
export const SHIFT_DURATION_MAX_MINUTES = 12 * 60;

/** Step between selectable shift durations. */
export const SHIFT_DURATION_STEP_MINUTES = 30;

/** Duration applied when a start time is first chosen for an empty cell (8h). */
export const DEFAULT_SHIFT_DURATION_MINUTES = 8 * 60;

/** Title shown on the schedule (and PDF) when no custom one is set. */
export const DEFAULT_SCHEDULE_TITLE = 'Shift Schedule';

/** Minutes in a calendar day. Used to wrap end-of-shift times past midnight. */
export const MINUTES_PER_DAY = 24 * 60;

export const DAYS_PER_WEEK = 7;

/** Weekday labels, Monday first — the week always starts on Monday (PLAN.md §1). */
export const DAY_LABELS = [
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
  'Sun',
] as const;
