import { createContext, useContext, useMemo } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { ShiftPreset } from '../types.ts';
import type { PresetsAction } from './presetsReducer.ts';
import { usePersistedPresets } from './usePersistedPresets.ts';

interface PresetsContextValue {
  presets: ShiftPreset[];
  dispatch: Dispatch<PresetsAction>;
}

const PresetsContext = createContext<PresetsContextValue | null>(null);

/** Owns the reusable shift-preset library, persisted across schedules. */
export function PresetsProvider({ children }: { children: ReactNode }) {
  const [presets, dispatch] = usePersistedPresets();
  const value = useMemo(() => ({ presets, dispatch }), [presets, dispatch]);
  return (
    <PresetsContext.Provider value={value}>{children}</PresetsContext.Provider>
  );
}

export function usePresets(): PresetsContextValue {
  const context = useContext(PresetsContext);
  if (!context) {
    throw new Error('usePresets must be used within a PresetsProvider');
  }
  return context;
}
