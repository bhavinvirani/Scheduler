import type { Assignment, Minutes } from '../types.ts';
import {
  MINUTES_PER_DAY,
  SHIFT_DURATION_MAX_MINUTES,
  SHIFT_DURATION_MIN_MINUTES,
  SHIFT_DURATION_STEP_MINUTES,
  TIME_INCREMENT_MINUTES,
} from '../constants.ts';

/** A `<select>` option: the stored minute value plus its human label. */
export interface TimeOption {
  value: Minutes;
  label: string;
}

/**
 * Render minutes-from-midnight as a 12-hour clock label (`7:30 AM`, `12:00 AM`).
 * Values are wrapped into a single day first, so a shift end past midnight
 * (start + duration ≥ 1440) reads as its clock time — 1440 is `12:00 AM`, never
 * `24:00`.
 */
export function minutesToLabel(minutes: Minutes): string {
  const inDay =
    ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours24 = Math.floor(inDay / 60);
  const mins = inDay % 60;
  const period = hours24 < 12 ? 'AM' : 'PM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${period}`;
}

/** Human duration: `8h`, `8h 30m`, `30m`. */
function formatDuration(minutes: Minutes): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** A shift as a clock range: `11:00 PM – 7:00 AM`. */
export function formatShiftRange(start: Minutes, duration: Minutes): string {
  return `${minutesToLabel(start)} – ${minutesToLabel(start + duration)}`;
}

/** Which of the three shift-fill colors a shift takes, from its start time. */
export type ShiftCategory = 'day' | 'evening' | 'night';

/**
 * Group a shift by start time so the grid can color it. Purely a visual
 * heuristic (day 05:00–11:59, evening 12:00–19:59, night otherwise) — it drives
 * the three shift-fill colors, not any scheduling rule.
 */
export function shiftCategory(start: Minutes): ShiftCategory {
  const inDay = ((start % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  if (inDay >= 300 && inDay < 720) return 'day';
  if (inDay >= 720 && inDay < 1200) return 'evening';
  return 'night';
}

/**
 * The text a cell shows on screen (in print) and anywhere an assignment needs a
 * label. Exhaustive over every `Assignment` kind — add a kind and the compiler
 * flags this switch.
 */
export function assignmentLabel(assignment: Assignment): string {
  switch (assignment.kind) {
    case 'shift':
      return formatShiftRange(assignment.start, assignment.duration);
    case 'off':
      return 'Off';
    case 'pto':
      return 'PTO';
    case 'holiday':
      return 'Holiday';
    case 'empty':
      return '';
  }
}

/** Every selectable start time across the day, in `TIME_INCREMENT_MINUTES` steps. */
export function startOptions(): TimeOption[] {
  const options: TimeOption[] = [];
  for (let m = 0; m < MINUTES_PER_DAY; m += TIME_INCREMENT_MINUTES) {
    options.push({ value: m, label: minutesToLabel(m) });
  }
  return options;
}

/**
 * End-time choices for a given start, expressed as relative durations rendered
 * as absolute clock times: `+8h (7:00 AM)`. This is the crux of the design —
 * the user picks a duration, so an overnight shift can never be stored as a
 * backwards end time. `duration` is exactly what every hours/rest calculation
 * needs, with no reverse-engineering.
 */
export function durationOptions(start: Minutes): TimeOption[] {
  const options: TimeOption[] = [];
  for (
    let d = SHIFT_DURATION_MIN_MINUTES;
    d <= SHIFT_DURATION_MAX_MINUTES;
    d += SHIFT_DURATION_STEP_MINUTES
  ) {
    options.push({
      value: d,
      label: `+${formatDuration(d)} (${minutesToLabel(start + d)})`,
    });
  }
  return options;
}
