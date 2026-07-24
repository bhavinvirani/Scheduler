# Connected Backup File — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user keep their schedule + presets + rules in a file they control, so a browser change or a wiped `localStorage` never loses their setup — with no backend and nothing uploaded.

**Architecture:** `localStorage` stays the primary store. A single versioned JSON backup (schedule + presets + rules) is the unit of durability. Phase A ships universal manual Download/Restore. Phase B adds a Chromium-only "connected file" that auto-saves on every change and restores on boot, with an "offer to load the newer file" conflict rule. All correctness lives in pure, node-testable modules; File System Access / IndexedDB / React glue is thin and Chrome-verified.

**Tech Stack:** React 18, TypeScript strict, Vitest (node env), native Blob download + File System Access API + IndexedDB. No new dependencies.

## Global Constraints

- No backend, no auth, no database. Static site only.
- Nothing is uploaded to a server; the backup file is local (optionally in the user's own cloud folder).
- No new export library (jsPDF/html2canvas/docx/SheetJS). Native download + File System Access only.
- Shifts stay `{ start: Minutes, duration: Minutes }`; assignments keyed `` `${personId}:${dayIndex}` ``; person identity is a UUID.
- ISO dates parsed with `parseISODateLocal`, never `new Date(isoString)`.
- `--alert` (`#C2410C`) reserved for coverage/rule warnings — do not use here.
- Tests run under `TZ=America/Toronto` (node env: no DOM/localStorage — inject storage in tests).
- Verify Chrome print preview before calling any phase complete (this feature adds no print surface, but confirm it prints nothing new).
- Existing validators to reuse: `isValidSchedule` (`src/state/scheduleStorage.ts`), `isValidPreset` (`src/state/presetsStorage.ts`), `isValidRule` (`src/state/rulesStorage.ts`), and the `serialize*`/`deserialize*` pairs + storage keys in those files.

## File Structure

- Create `src/lib/backupCodec.ts` — pure: build/serialize/parse/validate a `Backup`; `isFileNewer`; `decideBoot`.
- Create `src/lib/backupCodec.test.ts`.
- Create `src/state/backupStore.ts` — read/apply the three `localStorage` keys + a `:meta` savedAt (storage injected for tests).
- Create `src/state/backupStore.test.ts`.
- Create `src/lib/fileBackup.ts` — File System Access + IndexedDB glue (browser; not unit-tested).
- Create `src/state/BackupContext.tsx` — owns the connected handle + status; runs the sync effect; exposes actions.
- Create `src/components/BackupManager.tsx` — the "Backup…" modal.
- Create `src/components/BackupBanner.tsx` — boot banner (restore / offer-newer / first-run).
- Modify `src/App.tsx` — wrap in `BackupProvider`, render `BackupBanner`, run the boot gate.
- Modify `src/components/Toolbar.tsx` — add a "Backup…" button.

---

# PHASE A — Universal manual backup (every browser)

## Task 1: Backup codec (pure)

**Files:**

- Create: `src/lib/backupCodec.ts`
- Test: `src/lib/backupCodec.test.ts`

**Interfaces:**

- Consumes: `Schedule`, `ShiftPreset`, `Rule` from `../types.ts`; `isValidSchedule`, `isValidPreset`, `isValidRule` from the three storage modules.
- Produces:
  - `BACKUP_APP_ID = 'shift-schedule-builder'`, `BACKUP_SCHEMA_VERSION = 1`
  - `interface Backup { app: string; schemaVersion: number; savedAt: string; schedule: Schedule; presets: ShiftPreset[]; rules: Rule[]; }`
  - `buildBackup(schedule: Schedule, presets: ShiftPreset[], rules: Rule[], savedAt: string): Backup`
  - `serializeBackup(backup: Backup): string`
  - `parseBackup(text: string): Backup | null`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/backupCodec.test.ts
import { describe, it, expect } from 'vitest';
import type { Schedule } from '../types.ts';
import {
  buildBackup,
  serializeBackup,
  parseBackup,
  BACKUP_APP_ID,
} from './backupCodec.ts';

const schedule: Schedule = {
  version: 1,
  startDate: '2026-07-20',
  weekCount: 2,
  people: [{ id: 'p1', name: 'Ada' }],
  assignments: { 'p1:0': { kind: 'shift', start: 420, duration: 480 } },
};
const savedAt = '2026-07-24T19:30:00.000Z';

describe('backupCodec', () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/backupCodec.test.ts`
Expected: FAIL — cannot find module `./backupCodec.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/backupCodec.ts
import type { Rule, Schedule, ShiftPreset } from '../types.ts';
import { isValidSchedule } from '../state/scheduleStorage.ts';
import { isValidPreset } from '../state/presetsStorage.ts';
import { isValidRule } from '../state/rulesStorage.ts';

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
  if (!Array.isArray(value.presets) || !value.presets.every(isValidPreset))
    return null;
  if (!Array.isArray(value.rules) || !value.rules.every(isValidRule))
    return null;
  return {
    app: value.app,
    schemaVersion: value.schemaVersion,
    savedAt: value.savedAt,
    schedule: value.schedule,
    presets: value.presets,
    rules: value.rules,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/backupCodec.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/backupCodec.ts src/lib/backupCodec.test.ts
git commit -m "feat: add backup codec (build/serialize/parse + validation)"
```

## Task 2: localStorage read/apply store (pure, storage injected)

**Files:**

- Create: `src/state/backupStore.ts`
- Test: `src/state/backupStore.test.ts`

**Interfaces:**

- Consumes: storage keys + `serialize*`/`deserialize*` from the three storage modules; `Backup`, `buildBackup` from `../lib/backupCodec.ts`.
- Produces:
  - `META_STORAGE_KEY = 'shift-scheduler:v1:meta'`
  - `interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void; }`
  - `readLocalBackup(storage?: StorageLike): Backup | null`
  - `applyBackupToLocalStorage(backup: Backup, storage?: StorageLike): void`
  - `readMetaSavedAt(storage?: StorageLike): string | null`
  - `touchLocalSavedAt(savedAt: string, storage?: StorageLike): void`
  - `localSchedulePresent(storage?: StorageLike): boolean`

- [ ] **Step 1: Write the failing test**

```ts
// src/state/backupStore.test.ts
import { describe, it, expect } from 'vitest';
import { buildBackup } from '../lib/backupCodec.ts';
import {
  readLocalBackup,
  applyBackupToLocalStorage,
  readMetaSavedAt,
  localSchedulePresent,
} from './backupStore.ts';

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const schedule = {
  version: 1 as const,
  startDate: '2026-07-20',
  weekCount: 2 as const,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/state/backupStore.test.ts`
Expected: FAIL — cannot find module `./backupStore.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/state/backupStore.ts
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

export const META_STORAGE_KEY = 'shift-scheduler:v1:meta';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const store = (s?: StorageLike): StorageLike => s ?? localStorage;

/** True when a valid schedule is present — the anchor for "has data". */
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

/** Write all three stores + meta from a validated backup. Caller reloads after. */
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/state/backupStore.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/backupStore.ts src/state/backupStore.test.ts
git commit -m "feat: add backup localStorage read/apply store"
```

## Task 3: Manual Download / Restore UI (Phase A shippable)

**Files:**

- Create: `src/lib/downloadText.ts`
- Create: `src/components/BackupManager.tsx`
- Modify: `src/components/Toolbar.tsx` (add a "Backup…" button + modal state)
- Modify: `src/App.tsx` (no boot logic yet; nothing required beyond existing providers — BackupManager reads schedule/presets/rules via existing contexts, so the button lives in Toolbar which is already inside them)

**Interfaces:**

- Consumes: `useSchedule`, `usePresets`, `useRules`; `buildBackup`/`serializeBackup`/`parseBackup`; `applyBackupToLocalStorage`; `Modal`, `ConfirmDialog`.
- Produces: `downloadText(filename: string, text: string): void`; `<BackupManager open onClose />`.

- [ ] **Step 1: Create the download helper**

```ts
// src/lib/downloadText.ts
/** Trigger a browser download of text as a file. Native — no library. */
export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Create the BackupManager modal (manual only for now)**

```tsx
// src/components/BackupManager.tsx
import { useRef, useState } from 'react';
import { useSchedule } from '../state/ScheduleContext.tsx';
import { usePresets } from '../state/PresetsContext.tsx';
import { useRules } from '../state/RulesContext.tsx';
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
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `shift-schedule-backup-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);

  const doDownload = () => {
    const backup = buildBackup(
      schedule,
      presets,
      rules,
      new Date().toISOString(),
    );
    downloadText(backupFilename(), serializeBackup(backup));
  };

  const applyText = (text: string) => {
    const backup = parseBackup(text);
    if (!backup) {
      setError('That file is not a valid schedule backup.');
      return;
    }
    applyBackupToLocalStorage(backup);
    window.location.reload();
  };

  const onFile = async (file: File) => {
    setError(null);
    const text = await file.text();
    if (localSchedulePresent()) setPendingText(text);
    else applyText(text);
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
        {error && (
          <p className="mt-3 text-sm font-medium text-alert">{error}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={doDownload} className={primaryBtn}>
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
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onFile(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={onClose}
            className={`${secondaryBtn} ml-auto`}
          >
            Done
          </button>
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
    </>
  );
}
```

- [ ] **Step 3: Add the Backup… button to the Toolbar**

In `src/components/Toolbar.tsx`, add the import and a state flag, a button next to "Rules…", and render the modal near the other modals:

```tsx
// import
import { BackupManager } from './BackupManager.tsx';
// state (with the other useState flags)
const [backupOpen, setBackupOpen] = useState(false);
// button (place after the Rules… button)
<button
  type="button"
  onClick={() => setBackupOpen(true)}
  title="Save or restore a backup file"
  className={secondaryButton}
>
  Backup…
</button>
// modal (place next to <RulesManager .../>)
<BackupManager open={backupOpen} onClose={() => setBackupOpen(false)} />
```

- [ ] **Step 4: Verify the gate + Chrome**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green (61 unit tests + 6 new = confirm count rises by 6).

Manual (Chrome): open **Backup…** → **Download backup** downloads a JSON with schedule+presets+rules. Edit the schedule, then **Restore from file** the downloaded file → confirm dialog (data present) → reload → schedule restored. Clear `localStorage` in DevTools, reload, **Restore from file** → restores without a confirm. Confirm the file/modal never appears in Print preview.

- [ ] **Step 5: Commit**

```bash
git add src/lib/downloadText.ts src/components/BackupManager.tsx src/components/Toolbar.tsx
git commit -m "feat: manual backup download and restore (all browsers)"
```

---

# PHASE B — Connected file auto-save (Chromium)

## Task 4: Boot decision + newer-file check (pure)

**Files:**

- Modify: `src/lib/backupCodec.ts` (add `isFileNewer`, `decideBoot`)
- Modify: `src/lib/backupCodec.test.ts`

**Interfaces:**

- Produces:
  - `isFileNewer(fileSavedAt: string, localSavedAt: string | null): boolean`
  - `type BootDecision = 'use-local' | 'restore-file' | 'offer-restore' | 'offer-newer' | 'first-run'`
  - `decideBoot(p: { localPresent: boolean; handleConnected: boolean; permissionGranted: boolean; fileSavedAt: string | null; localSavedAt: string | null }): BootDecision`

- [ ] **Step 1: Write the failing tests**

```ts
// append to src/lib/backupCodec.test.ts
import { isFileNewer, decideBoot } from './backupCodec.ts';

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
    fileSavedAt: null,
    localSavedAt: '2026-07-24T19:00:00Z',
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/backupCodec.test.ts`
Expected: FAIL — `isFileNewer`/`decideBoot` not exported.

- [ ] **Step 3: Implement**

```ts
// append to src/lib/backupCodec.ts
/** True only when the file's savedAt is strictly later (or local has none). */
export function isFileNewer(
  fileSavedAt: string,
  localSavedAt: string | null,
): boolean {
  if (localSavedAt === null) return true;
  const f = Date.parse(fileSavedAt);
  const l = Date.parse(localSavedAt);
  if (Number.isNaN(f)) return false;
  if (Number.isNaN(l)) return true;
  return f > l;
}

export type BootDecision =
  'use-local' | 'restore-file' | 'offer-restore' | 'offer-newer' | 'first-run';

/** Decide what to do on startup from the local + connected-file state. Pure. */
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/backupCodec.test.ts`
Expected: PASS (all backupCodec tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/backupCodec.ts src/lib/backupCodec.test.ts
git commit -m "feat: pure boot decision + newer-file check for connected backup"
```

## Task 5: File System Access + IndexedDB glue (browser)

**Files:**

- Create: `src/lib/fileBackup.ts`

**Interfaces:**

- Produces: `isFileBackupSupported()`, `pickSaveFile(suggestedName)`, `pickOpenFile()`, `readHandle(h)`, `writeHandle(h, text)`, `ensurePermission(h)`, `queryGranted(h)`, `saveHandle(h)`, `loadHandle()`, `clearHandle()`, `handleName(h)`.

- [ ] **Step 1: Implement (no unit test — browser API; verified in Task 8)**

```ts
// src/lib/fileBackup.ts
// File System Access API + IndexedDB handle persistence. Chromium only.
type PermState = 'granted' | 'denied' | 'prompt';
interface PermissionedHandle extends FileSystemFileHandle {
  queryPermission?(d: { mode: 'read' | 'readwrite' }): Promise<PermState>;
  requestPermission?(d: { mode: 'read' | 'readwrite' }): Promise<PermState>;
}
declare global {
  interface Window {
    showSaveFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle>;
    showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
  }
}

export function isFileBackupSupported(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}

const PICKER_TYPES = [
  { description: 'Schedule backup', accept: { 'application/json': ['.json'] } },
];

export async function pickSaveFile(
  suggestedName: string,
): Promise<FileSystemFileHandle | null> {
  if (!window.showSaveFilePicker) return null;
  return window.showSaveFilePicker({ suggestedName, types: PICKER_TYPES });
}

export async function pickOpenFile(): Promise<FileSystemFileHandle | null> {
  if (!window.showOpenFilePicker) return null;
  const [handle] = await window.showOpenFilePicker({
    types: PICKER_TYPES,
    multiple: false,
  });
  return handle ?? null;
}

export async function readHandle(
  handle: FileSystemFileHandle,
): Promise<string> {
  const file = await handle.getFile();
  return file.text();
}

export async function writeHandle(
  handle: FileSystemFileHandle,
  text: string,
): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

export async function queryGranted(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  const ph = handle as PermissionedHandle;
  if (!ph.queryPermission) return true;
  return (await ph.queryPermission({ mode })) === 'granted';
}

export async function ensurePermission(
  handle: FileSystemFileHandle,
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<boolean> {
  const ph = handle as PermissionedHandle;
  if (!ph.queryPermission) return true;
  if ((await ph.queryPermission({ mode })) === 'granted') return true;
  return (await ph.requestPermission?.({ mode })) === 'granted';
}

export function handleName(handle: FileSystemFileHandle): string {
  return handle.name;
}

// --- IndexedDB handle persistence -----------------------------------------
const DB_NAME = 'shift-scheduler';
const STORE = 'handles';
const KEY = 'backup';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = run(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveHandle(handle: FileSystemFileHandle): Promise<void> {
  const db = await openDb();
  await tx(db, 'readwrite', (s) => s.put(handle, KEY));
}

export async function loadHandle(): Promise<FileSystemFileHandle | null> {
  try {
    const db = await openDb();
    return (
      (await tx<FileSystemFileHandle | undefined>(db, 'readonly', (s) =>
        s.get(KEY),
      )) ?? null
    );
  } catch {
    return null;
  }
}

export async function clearHandle(): Promise<void> {
  const db = await openDb();
  await tx(db, 'readwrite', (s) => s.delete(KEY));
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/fileBackup.ts
git commit -m "feat: File System Access + IndexedDB handle glue for backups"
```

## Task 6: BackupProvider (connect / open / disconnect + auto-save sync)

**Files:**

- Create: `src/state/BackupContext.tsx`

**Interfaces:**

- Consumes: `useSchedule`, `usePresets`, `useRules`; `fileBackup.*`; `buildBackup`/`serializeBackup`/`parseBackup`; `applyBackupToLocalStorage`/`touchLocalSavedAt`.
- Produces: `BackupProvider`, `useBackup()` → `{ supported, connected, fileName, lastSavedAt, saveError, connect(), open(), disconnect() }`.

- [ ] **Step 1: Implement**

```tsx
// src/state/BackupContext.tsx
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
import {
  buildBackup,
  parseBackup,
  serializeBackup,
} from '../lib/backupCodec.ts';
import { applyBackupToLocalStorage, touchLocalSavedAt } from './backupStore.ts';
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

interface BackupContextValue {
  supported: boolean;
  connected: boolean;
  fileName: string | null;
  lastSavedAt: string | null;
  saveError: boolean;
  connect(): Promise<void>;
  open(): Promise<void>;
  disconnect(): Promise<void>;
}

const BackupContext = createContext<BackupContextValue | null>(null);

const SAVE_DEBOUNCE_MS = 600;
const SUGGESTED_NAME = 'shift-schedule-backup.json';

export function BackupProvider({ children }: { children: ReactNode }) {
  const { schedule } = useSchedule();
  const { presets } = usePresets();
  const { rules } = useRules();

  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const first = useRef(true);

  // Reconnect a previously-chosen file (same browser) on mount.
  useEffect(() => {
    void loadHandle().then((h) => h && setHandle(h));
  }, []);

  // Mirror every change to the connected file, and always stamp local savedAt.
  useEffect(() => {
    const savedAt = new Date().toISOString();
    touchLocalSavedAt(savedAt);
    // Skip the write on the very first render (nothing changed yet).
    if (first.current) {
      first.current = false;
      return;
    }
    if (!handle) return;
    const timer = window.setTimeout(async () => {
      try {
        if (!(await ensurePermission(handle))) return;
        await writeHandle(
          handle,
          serializeBackup(buildBackup(schedule, presets, rules, savedAt)),
        );
        setSaveError(false);
        setLastSavedAt(savedAt);
      } catch {
        setSaveError(true);
      }
    }, SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [schedule, presets, rules, handle]);

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

  const open = useCallback(async () => {
    const picked = await pickOpenFile().catch(() => null);
    if (!picked) return;
    if (!(await ensurePermission(picked))) return;
    const backup = parseBackup(await readHandle(picked));
    if (!backup) return;
    await saveHandle(picked);
    applyBackupToLocalStorage(backup);
    window.location.reload();
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
  if (!context)
    throw new Error('useBackup must be used within a BackupProvider');
  return context;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/state/BackupContext.tsx
git commit -m "feat: BackupProvider with connect/open/disconnect + auto-save sync"
```

## Task 7: Boot gate + BackupBanner in App

**Files:**

- Create: `src/components/BackupBanner.tsx`
- Modify: `src/App.tsx` (wrap editor tree in `BackupProvider`; add the boot gate + banner)

**Interfaces:**

- Consumes: `decideBoot`, `parseBackup`; `readLocalBackup`/`applyBackupToLocalStorage`/`localSchedulePresent`/`readMetaSavedAt`; `fileBackup.*`; `useBackup`.
- Produces: `<BackupBanner />` (self-contained; runs the boot decision on mount).

- [ ] **Step 1: Implement BackupBanner (owns the boot decision)**

```tsx
// src/components/BackupBanner.tsx
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
  'rounded-sm bg-ink px-3 py-1 text-sm font-medium text-paper hover:bg-ink/85';
const secondary =
  'rounded-sm border border-rule bg-paper px-3 py-1 text-sm font-medium text-ink hover:bg-ink/5';

async function restoreHandle(handle: FileSystemFileHandle) {
  if (!(await ensurePermission(handle))) return;
  const backup = parseBackup(await readHandle(handle));
  if (!backup) return;
  applyBackupToLocalStorage(backup);
  window.location.reload();
}

export function BackupBanner() {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // decide exactly once
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
      // 'use-local' and 'first-run' need no banner.
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
```

- [ ] **Step 2: Wire into App.tsx**

Wrap the editor tree in `BackupProvider` (inside `RulesProvider`) and render `<BackupBanner />` at the top of `ScheduleDocument`'s `<main>` (above `<WarningsPanel />`). Add imports:

```tsx
import { BackupProvider } from './state/BackupContext.tsx';
import { BackupBanner } from './components/BackupBanner.tsx';
```

Provider (editor branch only — NOT the shared read-only branch):

```tsx
<RulesProvider>
  <BackupProvider>
    <div className="min-h-screen bg-paper font-sans text-ink">
      <Toolbar />
      <ScheduleDocument />
      <UndoFlash />
    </div>
  </BackupProvider>
</RulesProvider>
```

In `ScheduleDocument`, first child of `<main>`:

```tsx
<BackupBanner />
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/BackupBanner.tsx src/App.tsx
git commit -m "feat: boot gate + banner for restore / newer-file / first-run"
```

## Task 8: Full BackupManager (connected-file UI + fallback) + Chrome verification

**Files:**

- Modify: `src/components/BackupManager.tsx` (add connected-file status + actions when supported)

**Interfaces:**

- Consumes: `useBackup()`.

- [ ] **Step 1: Extend BackupManager with the connected-file section**

At the top of the component add `const backup = useBackup();` and render, above the manual buttons, a supported-only block:

```tsx
{
  backup.supported && (
    <div className="mt-4 rounded-sm border border-rule p-3 text-sm">
      <p className="font-medium">
        {backup.connected
          ? `Connected: ${backup.fileName}`
          : 'No file connected'}
      </p>
      <p className="mt-0.5 text-ink/60">
        {backup.connected
          ? backup.saveError
            ? 'Last save failed — check the file is reachable.'
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
              onClick={() => void backup.open()}
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
  );
}
```

Keep the existing manual **Download backup / Restore from file** buttons below it (relabel the section heading text if helpful) — they remain the universal fallback.

- [ ] **Step 2: Full gate**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: all green.

- [ ] **Step 3: Chrome manual verification (record results)**

1. **Connect:** Backup… → Connect a file → pick `roster.json` in a local folder. Edit a cell → within ~1s the file updates (re-open it to confirm). Status shows "Auto-saving. Last saved …".
2. **Reconnect (same browser):** reload → no prompt, still connected (handle from IndexedDB), edits keep saving.
3. **Recovery:** DevTools → clear `localStorage` (leave IndexedDB) → reload. With permission still granted it auto-restores (reloads into your data); if permission prompts, the banner offers "Restore".
4. **New browser:** open in a fresh profile → first-run prompt; Backup… → Open a backup → pick the file → restores + connects.
5. **Offer-newer:** connect the same file in two profiles; edit + save in profile A; in profile B (older localStorage) reload → banner "Your backup file is newer … Load backup / Keep this browser's". Both choices behave.
6. **Fallback:** in Firefox, the connected-file block is hidden; Download/Restore still work.
7. **Print:** Print / PDF shows no backup UI or banner.

- [ ] **Step 4: Commit**

```bash
git add src/components/BackupManager.tsx
git commit -m "feat: connected-file status and actions in Backup manager"
```

## Task 9: Docs

**Files:**

- Modify: `README.md` (feature row + a "Keeping your data safe" how-to)
- Modify: `CLAUDE.md` (architecture note: backup store + connected file, localStorage-primary)

- [ ] **Step 1: README** — add a "Backup & restore" feature-table row and a short section explaining: everything lives in your browser; use Backup… to download a file or (Chrome/Edge) connect a file that auto-saves; put it in a synced folder for cross-device; a new browser needs one "Open a backup" click. No em-dashes in prose.

- [ ] **Step 2: CLAUDE.md** — under Architecture, note: `localStorage` stays primary; `src/lib/backupCodec.ts` is the pure backup format + boot decision; `backupStore.ts` reads/applies the three keys + `:meta` savedAt; `BackupContext` owns the connected File System Access handle (persisted in IndexedDB) and auto-saves on change; restore = write keys + reload; nothing is uploaded.

- [ ] **Step 3: Commit**

```bash
git add README.md CLAUDE.md
git commit -m "docs: document backup and restore"
```

---

## Self-review notes

- **Spec coverage:** backup format → Task 1; localStorage read/apply + meta → Task 2; manual download/restore (fallback) → Task 3; newer-file + boot decision → Task 4; File System Access + IndexedDB → Task 5; auto-save sync + connect/open/disconnect → Task 6; boot gate (restore-file/offer-restore/offer-newer/first-run) → Task 7; connected-file UI + Chrome matrix → Task 8; docs → Task 9. All spec sections covered.
- **Confirm-on-overwrite:** Task 3 (manual) and the reload-based restores in Tasks 6/7 — restores into empty localStorage skip confirm; manual restore over existing data confirms. (Connected "Open a backup" replaces intentionally; acceptable since the user explicitly opened a file. If a confirm is wanted there too, add a ConfirmDialog in Task 6 `open()`.)
- **Type consistency:** `Backup`, `BootDecision`, `decideBoot`, `readLocalBackup`, `applyBackupToLocalStorage`, `touchLocalSavedAt`, `isFileBackupSupported`, `pickSaveFile/pickOpenFile`, `readHandle/writeHandle`, `ensurePermission/queryGranted`, `saveHandle/loadHandle/clearHandle`, `useBackup` — names/signatures match across tasks.
- **Placeholder scan:** none.
