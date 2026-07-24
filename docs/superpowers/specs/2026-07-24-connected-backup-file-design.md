# Connected backup file — design

**Status:** approved design, pending implementation plan
**Date:** 2026-07-24

## Problem

All of a user's data lives in three `localStorage` keys, per-browser and
per-origin:

- `shift-scheduler:v1:current` — the schedule
- `shift-scheduler:v1:presets` — the preset library
- `shift-scheduler:v1:rules` — the rule library

A browser change, "clear browsing data", private mode, or a dead machine wipes
all of it, forcing the user to rebuild their whole setup (people, presets,
rules). We need durability and portability **without** a backend, an account, or
uploading anything to a server (project invariants). The answer is therefore a
copy of the data the user controls — a file — never our infrastructure.

## Approved model

`localStorage` stays the **primary** working store. A user-chosen **file** is a
continuously-updated **mirror** (the backup). The app restores from the file
when `localStorage` is empty. Conflict rule: **offer to load the newer file**
(never silently overwrite).

- Single device: file and `localStorage` move together; the recovery/conflict
  paths never trigger during normal use.
- New browser / wiped data: one click — "Open my backup file" — restores
  everything, then reconnects for ongoing sync.
- Two devices sharing the file via a synced folder (Drive/Dropbox/iCloud): when
  the file is newer than this browser's data, a non-blocking prompt offers to
  load it, so the newer backup is never silently clobbered.

Still no backend, no auth, nothing uploaded. The file is the user's, optionally
inside their own cloud folder.

## The unavoidable caveat

A brand-new browser has no idea which file is the user's: the File System Access
**handle** is persisted in IndexedDB, which is wiped alongside `localStorage`.
So recovery on a _new_ browser requires exactly one user gesture — "Open my
backup file". Within the _same_ browser, the handle survives and (with persisted
permission) reads can be silent. This is by design and must be communicated in
the UI; it is far cheaper than rebuilding the setup.

## Browser support & fallback

The File System Access API (`showSaveFilePicker` / `showOpenFilePicker` +
persistable handles) is **Chromium-only** (Chrome, Edge). Detected via
`'showSaveFilePicker' in window`.

- **Chromium:** full "connected file" — pick once, auto-saves on every change.
- **Firefox / Safari:** graceful fallback to **Download backup / Restore from
  file** (manual, same JSON), so no browser is left without a backup path.

Both paths share the same backup format and validation.

## Backup format

A single JSON object (also the download file contents):

```json
{
  "app": "shift-schedule-builder",
  "schemaVersion": 1,
  "savedAt": "2026-07-24T19:30:00.000Z",
  "schedule": {
    "version": 1,
    "startDate": "…",
    "weekCount": 2,
    "people": [],
    "assignments": {}
  },
  "presets": [],
  "rules": []
}
```

- `app` + `schemaVersion` gate parsing (reject foreign / future files clearly).
- `savedAt` (ISO) drives the newer-file comparison.
- `schedule` / `presets` / `rules` are exactly the shapes the existing
  serializers already produce.

## Architecture

### Pure core — `src/lib/backupCodec.ts` (TDD)

- `buildBackup(schedule, presets, rules, savedAt): Backup` — assemble the object.
- `serializeBackup(backup): string` / `parseBackup(raw: unknown): Backup | null`
  — parse + **re-validate** every part with the existing `isValidSchedule`,
  `isValidPreset`, `isValidRule`. Foreign `app`, wrong `schemaVersion`, corrupt
  parts, or a non-object all return `null`. Never throws.
- `isFileNewer(fileSavedAt, localSavedAt): boolean` — the conflict comparator,
  pure and unit-tested (equal timestamps → not newer; missing local → treat as
  newer only when localStorage is otherwise empty, handled by the caller).

This module is fully unit-testable in vitest (no browser APIs) and is where the
correctness risk concentrates.

### localStorage read/apply — `src/state/backupStore.ts`

- `readLocalBackup(): { backup, savedAt } | null` — read the three keys straight
  from `localStorage`, validate, and assemble a `Backup` (with the stored
  `savedAt` meta). `null` if the schedule key is empty/corrupt.
- `applyBackupToLocalStorage(backup)` — write the three keys + a
  `shift-scheduler:v1:meta` (`{ savedAt }`) key, then the caller reloads.
- `localSavedAt(): string | null` — read the meta key for the comparison.

**Applying a restore = write the keys, then `window.location.reload()`.** The
existing persistence hooks hydrate from `localStorage` on mount, so a reload is
the simplest correct way to bring a restored backup into React state — no new
reducer actions, no cross-context wiring. `savedAt` in `:meta` is refreshed on
every local write (a tiny effect alongside the existing autosave).

### File System Access glue — `src/lib/fileBackup.ts` (browser API, thin)

- `isFileBackupSupported(): boolean`.
- `pickSaveFile()` / `pickOpenFile()` → `FileSystemFileHandle`.
- `readHandle(handle): string` / `writeHandle(handle, text)`.
- `ensurePermission(handle, mode): boolean` — `queryPermission` then
  `requestPermission` (needs a user gesture).
- Handle persistence in IndexedDB: `saveHandle(handle)` / `loadHandle()` /
  `clearHandle()` (a 3-line IndexedDB wrapper; handles are structured-cloneable).

Kept deliberately thin because these can't be unit-tested under jsdom; verified
manually in Chrome.

### Sync hook — `src/state/useBackupSync.ts`

Mounted inside the schedule/presets/rules providers. Reads all three via their
hooks; on any change, debounce-writes `serializeBackup(buildBackup(...))` to the
connected handle (if connected and permission granted), and updates a
"last saved" status. Write failures surface a subtle indicator, never block
editing.

### Boot / recovery gate — in `App`

On mount (an async effect, with a brief loading state):

1. If `localStorage` has a valid schedule (the normal case): render the editor.
   If a handle is connected **and** its permission is already granted
   (`queryPermission === 'granted'`, i.e. persisted from a prior visit), read the
   file's `savedAt` silently and, if it is newer than `:meta` `savedAt`, show a
   **non-blocking banner**: "Your backup is newer (edited on another device).
   Load it? [Load backup] [Keep this browser's]".
2. If `localStorage` is empty:
   - Connected handle + permission already granted → read file, `applyBackup…`,
     reload.
   - Connected handle but permission not yet granted → prompt "Restore from your
     backup file" (one gesture re-grants permission, then read → apply → reload).
   - No handle → gentle first-run prompt: "Start fresh" or "Open a backup file".

The newer-file check in (1) only runs when permission is already granted, so it
never nags on boot. Without granted permission the check is deferred until the
user next opens **Backup…** (which re-grants via a gesture). Reads never happen
without permission; a silent boot read is best-effort, not guaranteed.

### UI — `src/components/BackupManager.tsx` + a "Backup…" toolbar button

Modal showing:

- **Status:** "Backup file: `roster.json` · saved 2m ago" or "Not connected."
- **Chromium actions:** _Connect a file_ (save-as, writes current data, stores
  handle), _Open a backup_ (restore + connect), _Disconnect_ (clear handle,
  keep localStorage).
- **Universal actions:** _Download backup_, _Restore from file_ (`<input
type=file>`).
- Short explanation of how it works + the privacy note (nothing uploaded).

Restoring **over** existing non-empty data asks for confirmation (reuse
`ConfirmDialog`); restoring into empty data does not.

## Safety & edge cases

- Every file read is re-validated; a corrupt/foreign file is rejected with a
  message and touches nothing.
- Permission denied / read fails / write fails → app keeps working from
  `localStorage`; status shows the problem.
- Disconnect forgets the handle only; data stays in `localStorage`.
- The backup file never contains anything not already in `localStorage`; no new
  data leaves the machine.

## Testing

- **Unit (vitest):** `backupCodec` (build/serialize/parse round-trip, foreign
  app, wrong version, each corrupt part, empty parts) and `isFileNewer` /
  boot-decision logic (a pure `decideBoot(localPresent, fileSavedAt,
localSavedAt)` returning `'use-local' | 'restore-file' | 'offer-newer' |
'first-run'` so the branching is tested without browser APIs).
- **Manual in Chrome:** connect a file, edit → file updates; wipe localStorage →
  reload → offered/auto-restored; simulate a newer file → banner; Firefox →
  download/restore fallback; print unaffected.

## Out of scope (deliberately)

- Real-time multi-device merge / field-level conflict resolution.
- Any server, account, OAuth, or third-party cloud API.
- Encryption of the backup file (it is local; the user controls where it lives).

## Invariants honored

No backend / no auth / no database; nothing uploaded to a server; no new export
library (native download + File System Access only); `--alert` untouched; one
component tree.
