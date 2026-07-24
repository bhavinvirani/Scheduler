import { describe, it, expect } from 'vitest';
import type { ShiftPreset } from '../types.ts';
import { deserializePresets, serializePresets } from './presetsStorage.ts';

const presets: ShiftPreset[] = [
  { id: 'a', name: 'Day', start: 420, duration: 480 },
  { id: 'b', name: 'Night', start: 1380, duration: 480 },
];

describe('presets storage', () => {
  it('round-trips a valid library', () => {
    expect(deserializePresets(serializePresets(presets))).toEqual(presets);
  });

  it('accepts an empty library (the user deleted every preset)', () => {
    expect(deserializePresets('[]')).toEqual([]);
  });

  it('returns null for missing storage', () => {
    expect(deserializePresets(null)).toBeNull();
  });

  it('returns null for non-JSON', () => {
    expect(deserializePresets('{not json')).toBeNull();
  });

  it('returns null when the payload is not an array', () => {
    expect(deserializePresets('{"id":"a"}')).toBeNull();
  });

  it('rejects a library containing a malformed preset', () => {
    const bad = JSON.stringify([
      { id: 'a', name: 'Day', start: 420, duration: 480 },
      { id: 'b', name: 'Night', start: 'oops', duration: 480 },
    ]);
    expect(deserializePresets(bad)).toBeNull();
  });

  it('rejects a preset with an out-of-range start', () => {
    const bad = JSON.stringify([
      { id: 'a', name: 'Day', start: 9999, duration: 480 },
    ]);
    expect(deserializePresets(bad)).toBeNull();
  });
});
