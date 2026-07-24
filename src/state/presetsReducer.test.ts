import { describe, it, expect } from 'vitest';
import type { ShiftPreset } from '../types.ts';
import { createDefaultPresets, presetsReducer } from './presetsReducer.ts';

const day: ShiftPreset = { id: 'a', name: 'Day', start: 420, duration: 480 };
const night: ShiftPreset = {
  id: 'b',
  name: 'Night',
  start: 1380,
  duration: 480,
};

describe('createDefaultPresets', () => {
  it('seeds Day, Evening, Night with unique ids', () => {
    const presets = createDefaultPresets();
    expect(presets.map((p) => p.name)).toEqual(['Day', 'Evening', 'Night']);
    expect(new Set(presets.map((p) => p.id)).size).toBe(3);
    expect(presets[0]).toMatchObject({ start: 420, duration: 480 });
  });
});

describe('presetsReducer', () => {
  it('appends a new preset with a fresh id, keeping the rest', () => {
    const next = presetsReducer([day], { type: 'ADD_PRESET' });
    expect(next).toHaveLength(2);
    expect(next[0]).toBe(day);
    expect(typeof next[1]?.id).toBe('string');
    expect(next[1]?.id).not.toBe('a');
  });

  it('patches a preset by id, leaving others untouched', () => {
    const next = presetsReducer([day, night], {
      type: 'UPDATE_PRESET',
      id: 'a',
      patch: { name: 'Early', start: 360 },
    });
    expect(next[0]).toEqual({
      id: 'a',
      name: 'Early',
      start: 360,
      duration: 480,
    });
    expect(next[1]).toBe(night);
  });

  it('ignores an update to an unknown id', () => {
    const state = [day];
    const next = presetsReducer(state, {
      type: 'UPDATE_PRESET',
      id: 'zzz',
      patch: { name: 'X' },
    });
    expect(next).toEqual(state);
  });

  it('removes a preset by id', () => {
    const next = presetsReducer([day, night], {
      type: 'REMOVE_PRESET',
      id: 'a',
    });
    expect(next).toEqual([night]);
  });

  it('restores the default library on reset', () => {
    const next = presetsReducer([], { type: 'RESET_PRESETS' });
    expect(next.map((p) => p.name)).toEqual(['Day', 'Evening', 'Night']);
  });
});
