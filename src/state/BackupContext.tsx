import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useSchedule } from './ScheduleContext.tsx';
import { usePresets } from './PresetsContext.tsx';
import { useRules } from './RulesContext.tsx';
import { buildBackup, serializeBackup } from '../lib/backupCodec.ts';
import { touchLocalSavedAt } from './backupStore.ts';
import {
  clearHandle,
  ensurePermission,
  handleName,
  isFileBackupSupported,
  loadHandle,
  pickOpenFile,
  pickSaveFile,
  readHandle,
  saveHandle,
  writeHandle,
} from '../lib/fileBackup.ts';

/**
 * A backup file the user picked, read but not yet applied. The caller validates
 * and confirms first, then calls `commit()` to connect the file, so opening a
 * backup can never silently clobber current data.
 */
export interface OpenedBackup {
  /** Raw file text — the caller parses + validates with `parseBackup`. */
  text: string;
  /** Persist the handle so the file is connected after the restore reload. */
  commit(): Promise<void>;
}

interface BackupContextValue {
  /** Whether the browser supports connecting a file (Chromium). */
  supported: boolean;
  connected: boolean;
  fileName: string | null;
  lastSavedAt: string | null;
  saveError: boolean;
  connect(): Promise<void>;
  open(): Promise<OpenedBackup | null>;
  disconnect(): Promise<void>;
}

const BackupContext = createContext<BackupContextValue | null>(null);

const SAVE_DEBOUNCE_MS = 600;
const SUGGESTED_NAME = 'shift-schedule-backup.json';

/**
 * Owns the connected backup file (a File System Access handle persisted in
 * IndexedDB) and mirrors every change to it. localStorage stays the primary
 * store — this only writes a copy out. Restores go through localStorage + reload.
 */
export function BackupProvider({ children }: { children: ReactNode }) {
  const { schedule } = useSchedule();
  const { presets } = usePresets();
  const { rules } = useRules();

  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  const handleRef = useRef<FileSystemFileHandle | null>(null);
  handleRef.current = handle;
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const firstData = useRef(true);

  // Reconnect a previously-chosen file (same browser) on mount.
  useEffect(() => {
    void loadHandle().then((existing) => existing && setHandle(existing));
  }, []);

  // Mirror real data changes to the connected file and stamp local savedAt.
  // Depends on the data only (handle read through a ref), so reconnecting a file
  // on load never triggers a spurious write; a fresh connect writes eagerly in
  // connect(). The first run (initial hydrate) is skipped — nothing changed yet.
  useEffect(() => {
    if (firstData.current) {
      firstData.current = false;
      return;
    }
    const savedAt = new Date().toISOString();
    touchLocalSavedAt(savedAt);
    const target = handleRef.current;
    if (!target) return;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (!(await ensurePermission(target))) return;
          await writeHandle(
            target,
            serializeBackup(buildBackup(schedule, presets, rules, savedAt)),
          );
          setSaveError(false);
          setLastSavedAt(savedAt);
        } catch {
          setSaveError(true);
        }
      })();
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [schedule, presets, rules]);

  const connect = useCallback(async () => {
    const picked = await pickSaveFile(SUGGESTED_NAME).catch(() => null);
    if (!picked) return;
    const savedAt = new Date().toISOString();
    await writeHandle(
      picked,
      serializeBackup(buildBackup(schedule, presets, rules, savedAt)),
    );
    await saveHandle(picked);
    touchLocalSavedAt(savedAt);
    setHandle(picked);
    setLastSavedAt(savedAt);
    setSaveError(false);
  }, [schedule, presets, rules]);

  const open = useCallback(async (): Promise<OpenedBackup | null> => {
    const picked = await pickOpenFile().catch(() => null);
    if (!picked) return null;
    if (!(await ensurePermission(picked))) return null;
    // Read only — the caller validates, confirms over existing data, then commits.
    const text = await readHandle(picked);
    return { text, commit: () => saveHandle(picked) };
  }, []);

  const disconnect = useCallback(async () => {
    await clearHandle();
    setHandle(null);
    setLastSavedAt(null);
    setSaveError(false);
  }, []);

  const value = useMemo<BackupContextValue>(
    () => ({
      supported: isFileBackupSupported(),
      connected: handle !== null,
      fileName: handle ? handleName(handle) : null,
      lastSavedAt,
      saveError,
      connect,
      open,
      disconnect,
    }),
    [handle, lastSavedAt, saveError, connect, open, disconnect],
  );

  return (
    <BackupContext.Provider value={value}>{children}</BackupContext.Provider>
  );
}

export function useBackup(): BackupContextValue {
  const context = useContext(BackupContext);
  if (!context) {
    throw new Error('useBackup must be used within a BackupProvider');
  }
  return context;
}
