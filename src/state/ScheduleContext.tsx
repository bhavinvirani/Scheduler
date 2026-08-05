import { createContext, useContext, useMemo } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { Schedule } from '../types.ts';
import type { Action } from './scheduleReducer.ts';
import type { WithHistoryAction } from './history.ts';
import { usePersistedSchedule } from './usePersistedSchedule.ts';

interface ScheduleContextValue {
  schedule: Schedule;
  dispatch: Dispatch<WithHistoryAction<Action>>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  flashedKeys: ReadonlySet<string>;
  flashNonce: number;
  flashAction: 'undo' | 'redo' | null;
  /** True in the shared "view-only" mode: components render static, non-editable. */
  readOnly: boolean;
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

/** Owns the single source of truth (with undo/redo) and hands it to the tree below. */
export function ScheduleProvider({ children }: { children: ReactNode }) {
  const {
    schedule,
    dispatch,
    canUndo,
    canRedo,
    undo,
    redo,
    flashedKeys,
    flashNonce,
    flashAction,
  } = usePersistedSchedule();
  const value = useMemo(
    () => ({
      schedule,
      dispatch,
      canUndo,
      canRedo,
      undo,
      redo,
      flashedKeys,
      flashNonce,
      flashAction,
      readOnly: false,
    }),
    [schedule, dispatch, canUndo, canRedo, undo, redo, flashedKeys, flashNonce, flashAction],
  );
  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}

const NO_FLASH: ReadonlySet<string> = new Set();

/**
 * Provides a fixed schedule with every mutation neutered — the read-only backing
 * for a shared "view-only" link. Nothing here touches localStorage, so opening a
 * shared roster never disturbs the viewer's own saved schedule.
 */
export function ReadOnlyScheduleProvider({
  schedule,
  children,
}: {
  schedule: Schedule;
  children: ReactNode;
}) {
  const value = useMemo<ScheduleContextValue>(
    () => ({
      schedule,
      dispatch: () => {},
      canUndo: false,
      canRedo: false,
      undo: () => {},
      redo: () => {},
      flashedKeys: NO_FLASH,
      flashNonce: 0,
      flashAction: null,
      readOnly: true,
    }),
    [schedule],
  );
  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}

/** Read the schedule and dispatch. Throws if used outside the provider. */
export function useSchedule(): ScheduleContextValue {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useSchedule must be used within a ScheduleProvider');
  }
  return context;
}
