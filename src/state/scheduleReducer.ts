import type { Assignment, CellKey, Person, Schedule } from '../types.ts';
import { DAYS_PER_WEEK } from '../constants.ts';
import { formatISODate, isValidISODate, mondayOf } from '../lib/dates.ts';

/**
 * Every mutation the app can make, as a named, serializable action. The reducer
 * below is a pure `(Schedule, Action) => Schedule`, so the entire business logic
 * is unit-testable without rendering a component — and undo/redo is a later
 * addition (a stack of past states), not a rewrite.
 */
export type Action =
  | { type: 'ADD_PERSON' }
  | { type: 'RENAME_PERSON'; id: string; name: string }
  | { type: 'REMOVE_PERSON'; id: string }
  | {
      type: 'SET_ASSIGNMENT';
      personId: string;
      dayIndex: number;
      value: Assignment;
    }
  | { type: 'SET_WEEK_COUNT'; count: 1 | 2 }
  | { type: 'SET_START_DATE'; iso: string }
  | { type: 'SET_TITLE'; title: string }
  | { type: 'COPY_WEEK_1_TO_2' }
  | { type: 'CLEAR_ALL' }
  | { type: 'LOAD'; schedule: Schedule };

/** The one place an assignment key is built. `${personId}:${dayIndex}`. */
export function cellKey(personId: string, dayIndex: number): CellKey {
  return `${personId}:${dayIndex}`;
}

/**
 * The single shared empty assignment. Returning one frozen instance (rather
 * than a fresh object per read) gives every unset cell a stable reference, so
 * memoized cells skip re-rendering when an unrelated cell changes.
 */
export const EMPTY_ASSIGNMENT: Assignment = Object.freeze({ kind: 'empty' });

/** Read a cell, defaulting an unset one to `empty` — the map only stores non-empty cells. */
export function getAssignment(
  schedule: Schedule,
  personId: string,
  dayIndex: number,
): Assignment {
  return schedule.assignments[cellKey(personId, dayIndex)] ?? EMPTY_ASSIGNMENT;
}

/** A fresh, empty schedule whose start date is snapped to Monday (defaults to this week). */
export function createEmptySchedule(startDate?: string): Schedule {
  // Fall back to today if the caller passes nothing or a malformed date — never
  // let an invalid string reach mondayOf and produce "NaN-NaN-NaN".
  const iso =
    startDate && isValidISODate(startDate)
      ? startDate
      : formatISODate(new Date());
  return {
    version: 1,
    startDate: mondayOf(iso),
    weekCount: 2,
    people: [],
    assignments: {},
  };
}

export function scheduleReducer(state: Schedule, action: Action): Schedule {
  switch (action.type) {
    case 'ADD_PERSON': {
      const person: Person = { id: crypto.randomUUID(), name: '' };
      return { ...state, people: [...state.people, person] };
    }

    case 'RENAME_PERSON': {
      return {
        ...state,
        people: state.people.map((person) =>
          person.id === action.id ? { ...person, name: action.name } : person,
        ),
      };
    }

    case 'REMOVE_PERSON': {
      const prefix = `${action.id}:`;
      const assignments: Record<CellKey, Assignment> = {};
      for (const [key, value] of Object.entries(state.assignments)) {
        if (!key.startsWith(prefix)) assignments[key] = value;
      }
      return {
        ...state,
        people: state.people.filter((person) => person.id !== action.id),
        assignments,
      };
    }

    case 'SET_ASSIGNMENT': {
      const key = cellKey(action.personId, action.dayIndex);
      const assignments = { ...state.assignments };
      // Keep the map minimal: an empty cell is the absence of a key, so reads
      // fall back to `{ kind: 'empty' }` and the persisted blob stays small.
      if (action.value.kind === 'empty') {
        delete assignments[key];
      } else {
        assignments[key] = action.value;
      }
      return { ...state, assignments };
    }

    case 'SET_WEEK_COUNT': {
      // Non-destructive on purpose: week-2 assignments survive at weekCount 1,
      // so a 2 → 1 → 2 toggle loses nothing.
      return { ...state, weekCount: action.count };
    }

    case 'SET_START_DATE': {
      // A cleared date input dispatches iso: '' — reject anything that isn't a
      // real calendar date so a bad value can never corrupt startDate.
      if (!isValidISODate(action.iso)) return state;
      return { ...state, startDate: mondayOf(action.iso) };
    }

    case 'SET_TITLE': {
      return { ...state, title: action.title };
    }

    case 'COPY_WEEK_1_TO_2': {
      const assignments = { ...state.assignments };
      for (const person of state.people) {
        for (let day = 0; day < DAYS_PER_WEEK; day++) {
          const source = state.assignments[cellKey(person.id, day)];
          const destKey = cellKey(person.id, day + DAYS_PER_WEEK);
          // Mirror week 1 exactly — including clearing week-2 cells whose week-1
          // counterpart is empty. "Overwriting week 2 completely."
          if (source) {
            assignments[destKey] = source;
          } else {
            delete assignments[destKey];
          }
        }
      }
      return { ...state, assignments };
    }

    case 'CLEAR_ALL': {
      // Clears the grid; keeps the roster, start date, and week count.
      return { ...state, assignments: {} };
    }

    case 'LOAD': {
      return action.schedule;
    }
  }
}
