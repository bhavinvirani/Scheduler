import { describe, it, expect } from 'vitest';
import { duplicateNameKeys, normalizeName } from './people.ts';

describe('normalizeName', () => {
  it('trims and lowercases', () => {
    expect(normalizeName('  Ada B ')).toBe('ada b');
  });
});

describe('duplicateNameKeys', () => {
  it('finds names shared by more than one person, ignoring case and spacing', () => {
    const dupes = duplicateNameKeys(['Ada', 'ada ', 'Ben']);
    expect(dupes.has('ada')).toBe(true);
    expect(dupes.has('ben')).toBe(false);
  });

  it('ignores blank names', () => {
    expect(duplicateNameKeys(['', '  ']).size).toBe(0);
  });
});
