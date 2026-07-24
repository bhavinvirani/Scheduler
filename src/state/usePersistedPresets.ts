import { useEffect, useReducer } from 'react';
import type { Dispatch } from 'react';
import type { ShiftPreset } from '../types.ts';
import { createDefaultPresets, presetsReducer } from './presetsReducer.ts';
import type { PresetsAction } from './presetsReducer.ts';
import {
  PRESETS_STORAGE_KEY,
  deserializePresets,
  serializePresets,
} from './presetsStorage.ts';

/** Hydrate the preset library, falling back to defaults on missing/corrupt storage. */
function initPresets(): ShiftPreset[] {
  try {
    return (
      deserializePresets(localStorage.getItem(PRESETS_STORAGE_KEY)) ??
      createDefaultPresets()
    );
  } catch {
    // localStorage itself can throw (private mode, blocked cookies).
    return createDefaultPresets();
  }
}

/**
 * The preset library wired to its own localStorage key — hydrated once, saved
 * on every change. Presets change rarely, so this saves immediately (no debounce).
 */
export function usePersistedPresets(): readonly [
  ShiftPreset[],
  Dispatch<PresetsAction>,
] {
  const [presets, dispatch] = useReducer(
    presetsReducer,
    undefined,
    initPresets,
  );

  useEffect(() => {
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, serializePresets(presets));
    } catch {
      // Storage unavailable — presets just won't persist. Not fatal.
    }
  }, [presets]);

  return [presets, dispatch] as const;
}
