import { useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';
import type { Schedule } from '../types.ts';
import type { Action } from './scheduleReducer.ts';
import { createEmptySchedule, scheduleReducer } from './scheduleReducer.ts';
import {
  STORAGE_KEY,
  deserializeSchedule,
  serializeSchedule,
} from './scheduleStorage.ts';

const AUTOSAVE_DEBOUNCE_MS = 300;

/** Hydrate from localStorage, guarding against missing/corrupt/blocked storage. */
function initSchedule(): Schedule {
  try {
    return (
      deserializeSchedule(localStorage.getItem(STORAGE_KEY)) ??
      createEmptySchedule()
    );
  } catch {
    // localStorage access itself can throw (private mode, blocked cookies).
    return createEmptySchedule();
  }
}

/**
 * The schedule reducer wired to localStorage: hydrated once on mount, saved on
 * every change with a short debounce so a burst of edits writes once.
 */
export function usePersistedSchedule(): readonly [Schedule, Dispatch<Action>] {
  const [schedule, dispatch] = useReducer(
    scheduleReducer,
    undefined,
    initSchedule,
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, serializeSchedule(schedule));
      } catch {
        // Storage full or unavailable — skip silently; the app stays usable.
      }
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [schedule]);

  return [schedule, dispatch] as const;
}
