import { useEffect, useRef, useState } from 'react';
import { decideBoot, parseBackup } from '../lib/backupCodec.ts';
import type { BootDecision } from '../lib/backupCodec.ts';
import {
  applyBackupToLocalStorage,
  localSchedulePresent,
  readMetaSavedAt,
} from '../state/backupStore.ts';
import {
  ensurePermission,
  loadHandle,
  queryGranted,
  readHandle,
} from '../lib/fileBackup.ts';

type Prompt =
  | { kind: 'offer-newer'; handle: FileSystemFileHandle }
  | { kind: 'offer-restore'; handle: FileSystemFileHandle };

const bar =
  'no-print mb-4 flex flex-wrap items-center gap-3 rounded-sm border border-rule bg-ink/[0.03] px-4 py-3 text-sm';
const primary =
  'rounded-sm bg-ink px-3 py-1 text-sm font-medium text-paper hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ink/60';
const secondary =
  'rounded-sm border border-rule bg-paper px-3 py-1 text-sm font-medium text-ink hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60';

/** Read the connected file (re-granting permission if needed) and restore it. */
async function restoreHandle(handle: FileSystemFileHandle) {
  if (!(await ensurePermission(handle))) return;
  const backup = parseBackup(await readHandle(handle));
  if (!backup) return;
  applyBackupToLocalStorage(backup);
  window.location.reload();
}

/**
 * Runs the boot decision once on mount. Auto-restores when localStorage is empty
 * and the file is readable; otherwise offers a one-click restore or "load newer".
 * Renders nothing in the normal (use-local / first-run) cases. Screen-only.
 */
export function BackupBanner() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      const handle = await loadHandle();
      const localPresent = localSchedulePresent();
      const permissionGranted = handle ? await queryGranted(handle) : false;
      let fileSavedAt: string | null = null;
      if (handle && permissionGranted) {
        try {
          fileSavedAt = parseBackup(await readHandle(handle))?.savedAt ?? null;
        } catch {
          fileSavedAt = null;
        }
      }
      const decision: BootDecision = decideBoot({
        localPresent,
        handleConnected: handle !== null,
        permissionGranted,
        fileSavedAt,
        localSavedAt: readMetaSavedAt(),
      });
      if (decision === 'restore-file' && handle) {
        await restoreHandle(handle);
      } else if (decision === 'offer-newer' && handle) {
        setPrompt({ kind: 'offer-newer', handle });
      } else if (decision === 'offer-restore' && handle) {
        setPrompt({ kind: 'offer-restore', handle });
      }
    })();
  }, []);

  if (!prompt) return null;

  return (
    <div className={bar}>
      <span className="flex-1">
        {prompt.kind === 'offer-newer'
          ? 'Your backup file is newer than this browser (edited elsewhere).'
          : 'A backup file is connected. Restore your data from it?'}
      </span>
      <button
        type="button"
        className={primary}
        onClick={() => void restoreHandle(prompt.handle)}
      >
        {prompt.kind === 'offer-newer' ? 'Load backup' : 'Restore'}
      </button>
      <button
        type="button"
        className={secondary}
        onClick={() => setPrompt(null)}
      >
        {prompt.kind === 'offer-newer' ? "Keep this browser's" : 'Not now'}
      </button>
    </div>
  );
}
