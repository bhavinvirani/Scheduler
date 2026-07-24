import { useRef, useState } from 'react';
import { useSchedule } from '../state/ScheduleContext.tsx';
import { usePresets } from '../state/PresetsContext.tsx';
import { useRules } from '../state/RulesContext.tsx';
import { useBackup } from '../state/BackupContext.tsx';
import {
  buildBackup,
  parseBackup,
  serializeBackup,
} from '../lib/backupCodec.ts';
import {
  applyBackupToLocalStorage,
  localSchedulePresent,
} from '../state/backupStore.ts';
import { downloadText } from '../lib/downloadText.ts';
import { Modal } from './Modal.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';

const primaryBtn =
  'rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink/85 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ink/60';
const secondaryBtn =
  'rounded-sm border border-rule bg-paper px-3 py-1.5 text-sm font-medium text-ink ' +
  'hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60';

function backupFilename(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `shift-schedule-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.json`;
}

export function BackupManager({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { schedule } = useSchedule();
  const { presets } = usePresets();
  const { rules } = useRules();
  const backup = useBackup();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState<(() => Promise<void>) | null>(
    null,
  );

  const doDownload = () => {
    const data = buildBackup(
      schedule,
      presets,
      rules,
      new Date().toISOString(),
    );
    downloadText(backupFilename(), serializeBackup(data));
  };

  const applyText = (text: string) => {
    const parsed = parseBackup(text);
    if (!parsed) {
      setError('That file is not a valid schedule backup.');
      return;
    }
    applyBackupToLocalStorage(parsed);
    window.location.reload();
  };

  const onFile = async (file: File) => {
    setError(null);
    const text = await file.text();
    if (localSchedulePresent()) setPendingText(text);
    else applyText(text);
  };

  // "Open a backup" (connect + restore): read the picked file, then apply it
  // through the same confirm gate as a manual restore so it can't silently
  // clobber current data. `commit` connects the file after a confirmed restore.
  const handleOpen = async () => {
    setError(null);
    const opened = await backup.open();
    if (!opened) return;
    const parsed = parseBackup(opened.text);
    if (!parsed) {
      setError('That file is not a valid schedule backup.');
      return;
    }
    const apply = async () => {
      await opened.commit();
      applyBackupToLocalStorage(parsed);
      window.location.reload();
    };
    if (localSchedulePresent()) setPendingOpen(() => apply);
    else await apply();
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        labelledBy="backup-title"
        describedBy="backup-desc"
        className="flex w-full max-w-md flex-col rounded-sm border border-rule bg-paper p-5"
      >
        <h2 id="backup-title" className="text-base font-semibold">
          Backup
        </h2>
        <p id="backup-desc" className="mt-2 text-sm text-ink/60">
          Save everything (schedule, presets, rules) to a file you keep, and
          restore it on any browser or device. Nothing is uploaded.
        </p>

        {backup.supported && (
          <div className="mt-4 rounded-sm border border-rule p-3 text-sm">
            <p className="font-medium">
              {backup.connected
                ? `Connected: ${backup.fileName}`
                : 'No file connected'}
            </p>
            <p className="mt-0.5 text-ink/60">
              {backup.connected
                ? backup.saveError
                  ? 'Last save failed. Check the file is still reachable.'
                  : backup.lastSavedAt
                    ? `Auto-saving. Last saved ${new Date(backup.lastSavedAt).toLocaleTimeString()}.`
                    : 'Auto-saving on every change.'
                : 'Pick a file (put it in a synced folder for cross-device) and it saves automatically.'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {!backup.connected ? (
                <>
                  <button
                    type="button"
                    className={primaryBtn}
                    onClick={() => void backup.connect()}
                  >
                    Connect a file
                  </button>
                  <button
                    type="button"
                    className={secondaryBtn}
                    onClick={() => void handleOpen()}
                  >
                    Open a backup
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={secondaryBtn}
                  onClick={() => void backup.disconnect()}
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm font-medium text-alert">{error}</p>
        )}

        <div className="mt-4 border-t border-rule pt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink/50">
            {backup.supported ? 'Or a one-off file' : 'Backup file'}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={doDownload} className={secondaryBtn}>
              Download backup
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={secondaryBtn}
            >
              Restore from file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onFile(file);
                event.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={onClose}
              className={`${primaryBtn} ml-auto`}
            >
              Done
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingText !== null}
        title="Replace current data?"
        message="Restoring this backup replaces your current schedule, presets, and rules in this browser."
        confirmLabel="Restore"
        cancelLabel="Cancel"
        onConfirm={() => pendingText && applyText(pendingText)}
        onCancel={() => setPendingText(null)}
      />

      <ConfirmDialog
        open={pendingOpen !== null}
        title="Replace current data?"
        message="Opening this backup replaces your current schedule, presets, and rules in this browser, and connects the file for auto-save."
        confirmLabel="Open backup"
        cancelLabel="Cancel"
        onConfirm={() => void pendingOpen?.()}
        onCancel={() => setPendingOpen(null)}
      />
    </>
  );
}
