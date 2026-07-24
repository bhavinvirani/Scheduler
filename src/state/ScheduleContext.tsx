import { createContext, useContext, useMemo } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { Schedule } from '../types.ts';
import type { Action } from './scheduleReducer.ts';
import { usePersistedSchedule } from './usePersistedSchedule.ts';

interface ScheduleContextValue {
  schedule: Schedule;
  dispatch: Dispatch<Action>;
}

const ScheduleContext = createContext<ScheduleContextValue | null>(null);

/** Owns the single source of truth and hands it to the tree below. */
export function ScheduleProvider({ children }: { children: ReactNode }) {
  const [schedule, dispatch] = usePersistedSchedule();
  const value = useMemo(() => ({ schedule, dispatch }), [schedule, dispatch]);
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
