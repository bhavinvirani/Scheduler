import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { Dispatch } from 'react';
import type { Schedule } from '../types.ts';
import type { Action } from './scheduleReducer.ts';
import {
  changedAssignmentKeys,
  createEmptySchedule,
  scheduleReducer,
} from './scheduleReducer.ts';
import { initHistory, withHistory } from './history.ts';
import type { HistoryState, WithHistoryAction } from './history.ts';
import {
  STORAGE_KEY,
  deserializeSchedule,
  serializeSchedule,
} from './scheduleStorage.ts';

const AUTOSAVE_DEBOUNCE_MS = 300;

/**
 * The schedule reducer wrapped with undo/redo. Consecutive keystrokes in one
 * name field (or the title) collapse into a single undo step; every other edit
 * — including each painted or menu-filled cell — is its own step. `LOAD` (a
 * fresh hydrate) clears history so you can't undo across documents.
 */
const historyReducer = withHistory(scheduleReducer, {
  isReset: (action) => action.type === 'LOAD',
  coalesceKey: (action) => {
    switch (action.type) {
      case 'RENAME_PERSON':
        return `rename:${action.id}`;
      case 'SET_TITLE':
        return 'title';
      default:
        return null;
    }
  },
});

/** Hydrate from localStorage (guarded) and seed an empty history around it. */
function initHistoryState(): HistoryState<Schedule> {
  let present: Schedule;
  try {
    present =
      deserializeSchedule(localStorage.getItem(STORAGE_KEY)) ??
      createEmptySchedule();
  } catch {
    // localStorage access itself can throw (private mode, blocked cookies).
    present = createEmptySchedule();
  }
  return initHistory(present);
}

export interface PersistedSchedule {
  schedule: Schedule;
  dispatch: Dispatch<WithHistoryAction<Action>>;
  canUndo: boolean;
  canRedo: boolean;
  /** Run an undo, remembering which cells changed so the UI can flash them. */
  undo: () => void;
  redo: () => void;
  /** Assignment keys the last undo/redo touched, and a bump-on-each nonce. */
  flashedKeys: ReadonlySet<string>;
  flashNonce: number;
  flashAction: 'undo' | 'redo' | null;
}

/**
 * The schedule wired to localStorage and undo/redo: hydrated once on mount,
 * `present` saved on every change with a short debounce. Only `present`
 * persists — undo history is session-only, as users expect.
 */
export function usePersistedSchedule(): PersistedSchedule {
  const [history, dispatch] = useReducer(
    historyReducer,
    undefined,
    initHistoryState,
  );
  const schedule = history.present;

  // Which cells the last undo/redo changed — drives the transient cell flash.
  const [flash, setFlash] = useState<{
    keys: ReadonlySet<string>;
    nonce: number;
    /** What the user just did — drives the aria-live announcement. */
    action: 'undo' | 'redo' | null;
  }>({ keys: new Set(), nonce: 0, action: null });

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

  // undo/redo flag the cells they will change (present vs the restore target)
  // before dispatching, so the flash effect can highlight exactly what moved.
  // Read history through a ref so these callbacks stay reference-stable across
  // renders — otherwise every edit would re-subscribe the keyboard shortcuts.
  const historyRef = useRef(history);
  historyRef.current = history;

  const undo = useCallback(() => {
    const current = historyRef.current;
    if (current.past.length === 0) return;
    const target = current.past[current.past.length - 1]!;
    const keys = changedAssignmentKeys(current.present, target);
    setFlash((prev) => ({ keys: new Set(keys), nonce: prev.nonce + 1, action: 'undo' }));
    dispatch({ type: 'UNDO' });
  }, []);

  const redo = useCallback(() => {
    const current = historyRef.current;
    if (current.future.length === 0) return;
    const target = current.future[0]!;
    const keys = changedAssignmentKeys(current.present, target);
    setFlash((prev) => ({ keys: new Set(keys), nonce: prev.nonce + 1, action: 'redo' }));
    dispatch({ type: 'REDO' });
  }, []);

  return {
    schedule,
    dispatch,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    undo,
    redo,
    flashedKeys: flash.keys,
    flashNonce: flash.nonce,
    flashAction: flash.action,
  };
}
