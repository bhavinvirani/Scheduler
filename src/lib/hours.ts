import type { Schedule } from '../types.ts';
import { DAYS_PER_WEEK } from '../constants.ts';
import { getAssignment } from '../state/scheduleReducer.ts';

export interface PersonSummary {
  /** Worked minutes per active week (one entry per `weekCount`). */
  weekMinutes: number[];
  /** Worked minutes across all active weeks. */
  totalMinutes: number;
  offDays: number;
  ptoDays: number;
  holidayDays: number;
}

/**
 * Tally a person's worked hours and absence days across the active weeks.
 *
 * An overnight shift counts in the week that contains its *start* day — a shift
 * is stored on the day it begins, so its whole duration belongs to that day's
 * week. Days beyond `weekCount` are ignored even if their assignments linger in
 * the map (toggling week count is non-destructive).
 */
export function summarizePerson(
  schedule: Schedule,
  personId: string,
): PersonSummary {
  const weekMinutes: number[] = [];
  let offDays = 0;
  let ptoDays = 0;
  let holidayDays = 0;

  for (let week = 0; week < schedule.weekCount; week++) {
    let minutes = 0;
    for (let day = 0; day < DAYS_PER_WEEK; day++) {
      const assignment = getAssignment(
        schedule,
        personId,
        week * DAYS_PER_WEEK + day,
      );
      switch (assignment.kind) {
        case 'shift':
          minutes += assignment.duration;
          break;
        case 'off':
          offDays++;
          break;
        case 'pto':
          ptoDays++;
          break;
        case 'holiday':
          holidayDays++;
          break;
        case 'empty':
          break;
      }
    }
    weekMinutes.push(minutes);
  }

  const totalMinutes = weekMinutes.reduce((sum, minutes) => sum + minutes, 0);
  return { weekMinutes, totalMinutes, offDays, ptoDays, holidayDays };
}

/** Minutes as one-decimal hours: `40.0h`, `8.5h`. */
export function formatHours(minutes: number): string {
  return `${(minutes / 60).toFixed(1)}h`;
}
