import { useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';
import type { Rule } from '../types.ts';
import { createDefaultRules, rulesReducer } from './rulesReducer.ts';
import type { RulesAction } from './rulesReducer.ts';
import {
  RULES_STORAGE_KEY,
  deserializeRules,
  serializeRules,
} from './rulesStorage.ts';

/** Hydrate the rule library, falling back to defaults on missing/corrupt storage. */
function initRules(): Rule[] {
  try {
    return (
      deserializeRules(localStorage.getItem(RULES_STORAGE_KEY)) ??
      createDefaultRules()
    );
  } catch {
    // localStorage itself can throw (private mode, blocked cookies).
    return createDefaultRules();
  }
}

/**
 * The rule library wired to its own localStorage key — hydrated once, saved on
 * every change. Rules change rarely, so this saves immediately (no debounce).
 */
export function usePersistedRules(): readonly [Rule[], Dispatch<RulesAction>] {
  const [rules, dispatch] = useReducer(rulesReducer, undefined, initRules);

  useEffect(() => {
    try {
      localStorage.setItem(RULES_STORAGE_KEY, serializeRules(rules));
    } catch {
      // Storage unavailable — rules just won't persist. Not fatal.
    }
  }, [rules]);

  return [rules, dispatch] as const;
}
