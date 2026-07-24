import type { Backup } from '../lib/backupCodec.ts';
import { buildBackup } from '../lib/backupCodec.ts';
import {
  STORAGE_KEY,
  deserializeSchedule,
  serializeSchedule,
} from './scheduleStorage.ts';
import {
  PRESETS_STORAGE_KEY,
  deserializePresets,
  serializePresets,
} from './presetsStorage.ts';
import {
  RULES_STORAGE_KEY,
  deserializeRules,
  serializeRules,
} from './rulesStorage.ts';

/** localStorage key holding `{ savedAt }` — the last local write time. */
export const META_STORAGE_KEY = 'shift-scheduler:v1:meta';

/** The slice of the Storage API this module needs (injected in tests). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const store = (s?: StorageLike): StorageLike => s ?? localStorage;

/** True when a valid schedule is present — the anchor for "this browser has data". */
export function localSchedulePresent(s?: StorageLike): boolean {
  return deserializeSchedule(store(s).getItem(STORAGE_KEY)) !== null;
}

export function readMetaSavedAt(s?: StorageLike): string | null {
  try {
    const meta = JSON.parse(store(s).getItem(META_STORAGE_KEY) ?? 'null');
    return meta && typeof meta.savedAt === 'string' ? meta.savedAt : null;
  } catch {
    return null;
  }
}

export function touchLocalSavedAt(savedAt: string, s?: StorageLike): void {
  store(s).setItem(META_STORAGE_KEY, JSON.stringify({ savedAt }));
}

/** Assemble the current localStorage state as a Backup, or null if empty/corrupt. */
export function readLocalBackup(s?: StorageLike): Backup | null {
  const storage = store(s);
  const schedule = deserializeSchedule(storage.getItem(STORAGE_KEY));
  if (!schedule) return null;
  const presets =
    deserializePresets(storage.getItem(PRESETS_STORAGE_KEY)) ?? [];
  const rules = deserializeRules(storage.getItem(RULES_STORAGE_KEY)) ?? [];
  const savedAt = readMetaSavedAt(storage) ?? '1970-01-01T00:00:00.000Z';
  return buildBackup(schedule, presets, rules, savedAt);
}

/**
 * Write all three stores + the meta savedAt from a validated backup. The caller
 * reloads afterward so the persistence hooks re-hydrate from localStorage.
 */
export function applyBackupToLocalStorage(
  backup: Backup,
  s?: StorageLike,
): void {
  const storage = store(s);
  storage.setItem(STORAGE_KEY, serializeSchedule(backup.schedule));
  storage.setItem(PRESETS_STORAGE_KEY, serializePresets(backup.presets));
  storage.setItem(RULES_STORAGE_KEY, serializeRules(backup.rules));
  touchLocalSavedAt(backup.savedAt, storage);
}
