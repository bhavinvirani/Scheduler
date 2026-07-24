import { describe, it, expect } from 'vitest';
import type { Schedule } from '../types.ts';
import { buildBackup } from '../lib/backupCodec.ts';
import {
  applyBackupToLocalStorage,
  localSchedulePresent,
  readLocalBackup,
  readMetaSavedAt,
} from './backupStore.ts';

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const schedule: Schedule = {
  version: 1,
  startDate: '2026-07-20',
  weekCount: 2,
  people: [{ id: 'p1', name: 'Ada' }],
  assignments: {},
};

describe('backupStore', () => {
  it('returns null when there is no schedule in storage', () => {
    expect(readLocalBackup(fakeStorage())).toBeNull();
    expect(localSchedulePresent(fakeStorage())).toBe(false);
  });

  it('applies a backup and reads it straight back', () => {
    const storage = fakeStorage();
    const backup = buildBackup(schedule, [], [], '2026-07-24T19:30:00.000Z');
    applyBackupToLocalStorage(backup, storage);
    expect(localSchedulePresent(storage)).toBe(true);
    expect(readMetaSavedAt(storage)).toBe('2026-07-24T19:30:00.000Z');
    expect(readLocalBackup(storage)).toEqual(backup);
  });
});
