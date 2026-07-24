import { describe, it, expect } from 'vitest';
import type { Schedule } from '../types.ts';
import {
  BACKUP_APP_ID,
  buildBackup,
  decideBoot,
  isFileNewer,
  parseBackup,
  serializeBackup,
} from './backupCodec.ts';

const schedule: Schedule = {
  version: 1,
  startDate: '2026-07-20',
  weekCount: 2,
  people: [{ id: 'p1', name: 'Ada' }],
  assignments: { 'p1:0': { kind: 'shift', start: 420, duration: 480 } },
};
const savedAt = '2026-07-24T19:30:00.000Z';

describe('backupCodec — format', () => {
  it('round-trips a full backup', () => {
    const backup = buildBackup(schedule, [], [], savedAt);
    expect(backup.app).toBe(BACKUP_APP_ID);
    expect(parseBackup(serializeBackup(backup))).toEqual(backup);
  });

  it('rejects a foreign app or wrong schema version', () => {
    const backup = buildBackup(schedule, [], [], savedAt);
    expect(
      parseBackup(serializeBackup({ ...backup, app: 'something-else' })),
    ).toBeNull();
    expect(
      parseBackup(serializeBackup({ ...backup, schemaVersion: 2 })),
    ).toBeNull();
  });

  it('rejects non-JSON, non-object, and a corrupt schedule', () => {
    expect(parseBackup('{')).toBeNull();
    expect(parseBackup('null')).toBeNull();
    const backup = buildBackup(schedule, [], [], savedAt);
    expect(
      parseBackup(
        serializeBackup({
          ...backup,
          schedule: { version: 9 } as unknown as Schedule,
        }),
      ),
    ).toBeNull();
  });

  it('rejects a corrupt preset or rule but accepts empty arrays', () => {
    const backup = buildBackup(schedule, [], [], savedAt);
    expect(
      parseBackup(
        serializeBackup({ ...backup, presets: [{ id: 'x' } as never] }),
      ),
    ).toBeNull();
    expect(
      parseBackup(
        serializeBackup({ ...backup, rules: [{ type: 'nope' } as never] }),
      ),
    ).toBeNull();
    expect(parseBackup(serializeBackup(backup))).not.toBeNull();
  });
});

describe('isFileNewer', () => {
  it('is true only when the file timestamp is strictly later', () => {
    expect(isFileNewer('2026-07-24T20:00:00Z', '2026-07-24T19:00:00Z')).toBe(
      true,
    );
    expect(isFileNewer('2026-07-24T19:00:00Z', '2026-07-24T19:00:00Z')).toBe(
      false,
    );
    expect(isFileNewer('2026-07-24T18:00:00Z', '2026-07-24T19:00:00Z')).toBe(
      false,
    );
    expect(isFileNewer('2026-07-24T20:00:00Z', null)).toBe(true);
  });
});

describe('decideBoot', () => {
  const base = {
    localPresent: true,
    handleConnected: false,
    permissionGranted: false,
    fileSavedAt: null as string | null,
    localSavedAt: '2026-07-24T19:00:00Z' as string | null,
  };

  it('uses local when nothing is connected', () => {
    expect(decideBoot(base)).toBe('use-local');
  });

  it('offers the newer file when connected, permitted, and newer', () => {
    expect(
      decideBoot({
        ...base,
        handleConnected: true,
        permissionGranted: true,
        fileSavedAt: '2026-07-24T20:00:00Z',
      }),
    ).toBe('offer-newer');
  });

  it('uses local when the connected file is not newer', () => {
    expect(
      decideBoot({
        ...base,
        handleConnected: true,
        permissionGranted: true,
        fileSavedAt: '2026-07-24T18:00:00Z',
      }),
    ).toBe('use-local');
  });

  it('restores automatically when local is empty and the file is readable', () => {
    expect(
      decideBoot({
        ...base,
        localPresent: false,
        handleConnected: true,
        permissionGranted: true,
        fileSavedAt: '2026-07-24T18:00:00Z',
      }),
    ).toBe('restore-file');
  });

  it('offers to restore when local is empty and permission is not yet granted', () => {
    expect(
      decideBoot({
        ...base,
        localPresent: false,
        handleConnected: true,
        permissionGranted: false,
        fileSavedAt: null,
      }),
    ).toBe('offer-restore');
  });

  it('is first-run when local is empty and nothing is connected', () => {
    expect(decideBoot({ ...base, localPresent: false })).toBe('first-run');
  });
});
