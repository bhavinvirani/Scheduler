import { createContext, useContext, useMemo } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { Rule } from '../types.ts';
import type { RulesAction } from './rulesReducer.ts';
import { usePersistedRules } from './usePersistedRules.ts';

interface RulesContextValue {
  rules: Rule[];
  dispatch: Dispatch<RulesAction>;
}

const RulesContext = createContext<RulesContextValue | null>(null);

/** Owns the user-defined rule library, persisted across schedules. */
export function RulesProvider({ children }: { children: ReactNode }) {
  const [rules, dispatch] = usePersistedRules();
  const value = useMemo(() => ({ rules, dispatch }), [rules, dispatch]);
  return (
    <RulesContext.Provider value={value}>{children}</RulesContext.Provider>
  );
}

export function useRules(): RulesContextValue {
  const context = useContext(RulesContext);
  if (!context) {
    throw new Error('useRules must be used within a RulesProvider');
  }
  return context;
}
