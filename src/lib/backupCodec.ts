import type { Rule, Schedule, ShiftPreset } from '../types.ts';
import { isValidSchedule } from '../state/scheduleStorage.ts';
import { isValidPreset } from '../state/presetsStorage.ts';
import { isValidRule } from '../state/rulesStorage.ts';

/**
 * The backup file format: everything a user has set up, as one portable,
 * versioned JSON. It is the unit of durability — written to a file the user
 * controls, never uploaded. Every field is re-validated on read because a
 * backup file is untrusted input (hand-edited, older version, wrong app).
 */
export const BACKUP_APP_ID = 'shift-schedule-builder';
export const BACKUP_SCHEMA_VERSION = 1;

export interface Backup {
  app: string;
  schemaVersion: number;
  /** ISO timestamp of when this backup was written. Drives the newer-file check. */
  savedAt: string;
  schedule: Schedule;
  presets: ShiftPreset[];
  rules: Rule[];
}

export function buildBackup(
  schedule: Schedule,
  presets: ShiftPreset[],
  rules: Rule[],
  savedAt: string,
): Backup {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    savedAt,
    schedule,
    presets,
    rules,
  };
}

/** Pretty-printed so a user opening the file by hand can read it. */
export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Parse + fully re-validate an untrusted backup file. Never throws. */
export function parseBackup(text: string): Backup | null {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(value)) return null;
  if (value.app !== BACKUP_APP_ID) return null;
  if (value.schemaVersion !== BACKUP_SCHEMA_VERSION) return null;
  if (typeof value.savedAt !== 'string') return null;
  if (!isValidSchedule(value.schedule)) return null;
  if (!Array.isArray(value.presets) || !value.presets.every(isValidPreset)) {
    return null;
  }
  if (!Array.isArray(value.rules) || !value.rules.every(isValidRule)) {
    return null;
  }
  return {
    app: value.app,
    schemaVersion: value.schemaVersion,
    savedAt: value.savedAt,
    schedule: value.schedule,
    presets: value.presets,
    rules: value.rules,
  };
}

/** True only when the file's savedAt is strictly later (or local has none). */
export function isFileNewer(
  fileSavedAt: string,
  localSavedAt: string | null,
): boolean {
  if (localSavedAt === null) return true;
  const file = Date.parse(fileSavedAt);
  const local = Date.parse(localSavedAt);
  if (Number.isNaN(file)) return false;
  if (Number.isNaN(local)) return true;
  return file > local;
}

export type BootDecision =
  'use-local' | 'restore-file' | 'offer-restore' | 'offer-newer' | 'first-run';

/**
 * Decide what to do on startup from the local + connected-file state. Pure, so
 * every branch is unit-tested without touching the browser.
 */
export function decideBoot(p: {
  localPresent: boolean;
  handleConnected: boolean;
  permissionGranted: boolean;
  fileSavedAt: string | null;
  localSavedAt: string | null;
}): BootDecision {
  if (p.localPresent) {
    if (
      p.handleConnected &&
      p.permissionGranted &&
      p.fileSavedAt !== null &&
      isFileNewer(p.fileSavedAt, p.localSavedAt)
    ) {
      return 'offer-newer';
    }
    return 'use-local';
  }
  if (!p.handleConnected) return 'first-run';
  if (p.permissionGranted && p.fileSavedAt !== null) return 'restore-file';
  return 'offer-restore';
}
