import type { ShiftPreset } from '../types.ts';
import {
  DEFAULT_PRESET_SEEDS,
  DEFAULT_SHIFT_DURATION_MINUTES,
  NEW_PRESET_START_MINUTES,
} from '../constants.ts';

/**
 * Presets are their own tiny domain — a flat, ordered list of shift templates
 * with the same pure-reducer discipline as the schedule. They live in a
 * separate store (see PresetsContext) so editing the library never touches the
 * schedule or its undo history.
 */
export type PresetsAction =
  | { type: 'ADD_PRESET' }
  | {
      type: 'UPDATE_PRESET';
      id: string;
      patch: Partial<Omit<ShiftPreset, 'id'>>;
    }
  | { type: 'REMOVE_PRESET'; id: string }
  | { type: 'RESET_PRESETS' };

/** The starter library, with runtime-assigned ids. */
export function createDefaultPresets(): ShiftPreset[] {
  return DEFAULT_PRESET_SEEDS.map((seed) => ({
    id: crypto.randomUUID(),
    ...seed,
  }));
}

export function presetsReducer(
  state: ShiftPreset[],
  action: PresetsAction,
): ShiftPreset[] {
  switch (action.type) {
    case 'ADD_PRESET': {
      const preset: ShiftPreset = {
        id: crypto.randomUUID(),
        name: '',
        start: NEW_PRESET_START_MINUTES,
        duration: DEFAULT_SHIFT_DURATION_MINUTES,
      };
      return [...state, preset];
    }

    case 'UPDATE_PRESET': {
      return state.map((preset) =>
        preset.id === action.id ? { ...preset, ...action.patch } : preset,
      );
    }

    case 'REMOVE_PRESET': {
      return state.filter((preset) => preset.id !== action.id);
    }

    case 'RESET_PRESETS': {
      return createDefaultPresets();
    }
  }
}
