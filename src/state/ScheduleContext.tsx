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
    }),
    [schedule, dispatch, canUndo, canRedo, undo, redo, flashedKeys, flashNonce],
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
