# Shift Schedule Builder — Build Plan

A single-page, no-backend web app that replaces the manual Word/Excel process for producing bi-weekly shift schedules. Type names down the left, pick shift times per day, print to PDF.

This document is the spec. Hand it to Claude Code and work phase by phase.

---

## 1. Locked decisions

| Decision   | Choice                                           | Why                                                                                                                    |
| ---------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| Output     | **PDF via browser print only**                   | No export library. What's on screen _is_ the artifact — one rendering path, so screen and paper can never drift apart. |
| Cell input | **Two dropdowns: start time + end time**         | User's call. See §3 for how the end dropdown avoids the midnight trap.                                                 |
| Devices    | **Desktop first, mobile in Phase 2**             | A 7×N grid with two selects per cell does not fit 380px. Build the thing that replaces Excel, then make it pocketable. |
| Backend    | **None.** No auth, no server, no database.       | Static site.                                                                                                           |
| Stack      | Vite + React 18 + TypeScript (strict) + Tailwind | Matches existing side-project setup.                                                                                   |
| Deploy     | GitHub Pages via Actions workflow                | Free, static, zero ops.                                                                                                |
| Week start | **Monday**, always                               | Matches the existing document.                                                                                         |

### Decisions made on your behalf — override any of these before starting

- **30-minute time increments.** 60-minute is a nicer dropdown, but real shifts start at 7:30. Exposed as `TIME_INCREMENT_MINUTES` in `constants.ts` — one-line change.
- **Cell states beyond shifts:** `empty | shift | off | pto | holiday`. Modelled as a tagged union from day one. Retrofitting this later means touching every cell read site.
- **Day headers show dates** (`Mon` over `Jul 27`). Prevents the "which Monday?" error that a bare weekday name invites.
- **Team size up to ~25 rows.** Table gets a sticky header row and sticky name column.
- **Rule warnings are Phase 3**, but the data model supports them from Phase 1 (see §3).

---

## 2. The one thing to get right first: the end-time dropdown

An 11PM–7AM shift crosses midnight. If the end dropdown is a naive list of all 24 hours, `end = 07:00` with `start = 23:00` is ambiguous — is that an 8-hour night shift, or a backwards entry the user fat-fingered? You cannot tell from the data, and every downstream calculation has to guess.

**Populate the end dropdown as relative durations, rendered as absolute times.**

Start = `11:00 PM` → the end dropdown reads:

```
+4h  (3:00 AM)
+6h  (5:00 AM)
+8h  (7:00 AM)   ← typical
+10h (9:00 AM)
+12h (11:00 AM)
```

The user still picks an end time and still sees a clock time. But the invalid state is **impossible by construction**, not caught by validation. And `durationMinutes` — the number every hours-total and rest-period check needs — falls out for free instead of being reverse-engineered.

> **Why this matters beyond this app:** validation catches bad states after they exist. A type or a UI that can't express the bad state means the check never has to be written, never gets forgotten, and never drifts out of sync with the rules. Prefer making illegal states unrepresentable over validating them away.

Store `{ start: Minutes, duration: Minutes }`. Never `{ start, end }`. If you store end times, you will write `if (end <= start) end += 1440` in six different files, miss one, and produce a schedule showing someone working −16 hours.

---

## 3. Data model

`src/types.ts`:

```ts
/** Minutes from local midnight. 0 = 00:00, 450 = 07:30, 1380 = 23:00. */
export type Minutes = number;

export type Assignment =
  | { kind: 'empty' }
  | { kind: 'off' }
  | { kind: 'pto' }
  | { kind: 'holiday' }
  | { kind: 'shift'; start: Minutes; duration: Minutes };

export interface Person {
  /** crypto.randomUUID(). Stable across reorder and rename. */
  id: string;
  name: string;
}

/** `${personId}:${dayIndex}` where dayIndex is 0..13 (day 0 = week 1 Monday). */
export type CellKey = string;

export interface Schedule {
  /** Schema version. Bump on any breaking change; migrate on load. */
  version: 1;
  /** ISO date (YYYY-MM-DD). Always a Monday. */
  startDate: string;
  weekCount: 1 | 2;
  people: Person[];
  assignments: Record<CellKey, Assignment>;
}
```

**Why a flat `assignments` map instead of `Person[].days[14]`:**

- Removing a person is `people.filter(...)` plus a key prune — not a 2D array rebuild.
- Reordering people touches only `people`. Assignments don't move.
- Switching `weekCount` from 2 → 1 → 2 **preserves week-2 data**, because it was never nested inside a rendered structure. Toggling the week count is non-destructive and therefore safe to explore with.
- Immutable updates are a one-key spread, not nested `map` + index gymnastics.

**Why `Person.id` and not the array index:** array index as identity is the single most common React data bug. Delete row 2 and every assignment below it silently shifts up by one. Nobody notices until someone works a shift they weren't scheduled for.

**Why `startDate` is a string, not a `Date`:** `Date` doesn't round-trip through JSON and drags timezone semantics into a problem that has none. This is a **calendar date**, not an instant in time — a Monday is a Monday regardless of what clock you're standing next to.

> **Timezone landmine, read this twice.** `new Date('2026-07-27')` parses as **UTC midnight**. In Toronto (UTC−4) that is 8:00 PM on July **26** — your header renders "Sunday." Parse with explicit local components:
>
> ```ts
> export function parseISODateLocal(iso: string): Date {
>   const [y, m, d] = iso.split('-').map(Number);
>   return new Date(y, m - 1, d, 12); // noon, so DST shifts can't cross a day boundary
> }
> ```
>
> Noon rather than midnight because a DST transition can move midnight by an hour and land you on the previous day. Noon has 11 hours of slack in both directions.

---

## 4. Architecture

```
src/
  main.tsx
  App.tsx
  types.ts
  constants.ts              TIME_INCREMENT_MINUTES, DURATION_OPTIONS, DAY_LABELS
  state/
    scheduleReducer.ts      all mutations — pure, exported, testable
    usePersistedSchedule.ts hydrate from localStorage + debounced save
  lib/
    dates.ts                mondayOf, addDays, parseISODateLocal, formatDayHeader
    time.ts                 minutesToLabel, formatRange, startOptions, durationOptions
    coverage.ts             hourly coverage per day (drives the signature UI, §6)
    hours.ts                weeklyTotalMinutes  (Phase 2)
  components/
    Toolbar.tsx
    WeekTable.tsx
    PersonRow.tsx
    ShiftCell.tsx
    CoverageStrip.tsx
  styles/print.css
```

**`useReducer`, not scattered `useState`.** Every mutation becomes a named action:

```ts
type Action =
  | { type: 'ADD_PERSON' }
  | { type: 'RENAME_PERSON'; id: string; name: string }
  | { type: 'REMOVE_PERSON'; id: string }
  | {
      type: 'SET_ASSIGNMENT';
      personId: string;
      dayIndex: number;
      value: Assignment;
    }
  | { type: 'SET_WEEK_COUNT'; count: 1 | 2 }
  | { type: 'SET_START_DATE'; iso: string }
  | { type: 'COPY_WEEK_1_TO_2' }
  | { type: 'CLEAR_ALL' }
  | { type: 'LOAD'; schedule: Schedule };
```

The reducer is a pure `(Schedule, Action) => Schedule`. That means the entire business logic of this app is unit-testable **without rendering a single component** — no jsdom, no React Testing Library, no async. It also makes undo/redo a later addition (keep a stack of past states) rather than a rewrite.

**No Redux/Zustand.** One page, one tree, no server sync. `useReducer` + a context provider covers it with zero dependencies. If prop-drilling gets painful, add the context — don't reach for a library.

---

## 5. Print pipeline — the part that will silently break

Do **not** build a separate `<PrintView />` component. Two component trees rendering the same data is exactly how the screen and the PDF drift apart, and nobody catches it because nobody prints during development.

One tree, two CSS regimes.

**Selects don't print reliably.** Browsers render `<select>` chrome inconsistently in print — dropdown arrows, native borders, sometimes clipped text. Render both representations in each cell and swap with media queries:

```tsx
<td className="cell">
  <span className="hidden print:inline">{formatRange(assignment)}</span>
  <div className="print:hidden">
    <select value={...} onChange={...}>...</select>
    <select value={...} onChange={...}>...</select>
  </div>
</td>
```

`styles/print.css`:

```css
@page {
  size: A4 landscape;
  margin: 10mm;
}

@media print {
  .no-print {
    display: none !important;
  }

  /* A fortnight must never split across a page break. */
  .week-table {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  /* Browsers strip backgrounds by default; shift colors are information here. */
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* Sticky headers become floating garbage on paper. */
  .sticky {
    position: static !important;
  }
}
```

That last rule is the one that gets missed. `position: sticky` on the header row and name column is right for the screen and catastrophic on paper.

**Acceptance test:** open Chrome print preview (Cmd/Ctrl+P) after every phase. A phase is not done until the preview is correct. Verify: landscape, one page per fortnight, no app chrome, shift colors present, header row not floating.

---

## 6. Design direction

This is a **tool**, not a landing page. The screen should look like the paper it becomes: flat, dense, quiet. No cards, no drop shadows, no border-radius above 2px, no gradients.

**Palette** — cool industrial neutrals, with color reserved for meaning:

```
--ink:      #151A21   text, grid rules at low opacity
--paper:    #FBFBF9   background (prints clean, no ink waste)
--rule:     #D8DCE0   table borders
--day:      #3C7A6B   day shift fill
--evening:  #7A5AA8   evening shift fill
--night:    #26456E   night shift fill
--absent:   #EDEFF1   off / PTO / holiday — neutral, because absence should read as absence
--alert:    #C2410C   coverage gaps and rule warnings, and nothing else
```

The alert color is a **reserved channel**. It never appears as decoration, a hover state, or a button. Orange on this page always means "something is wrong." That constraint is worth more than any styling choice on the page.

**Type** — IBM Plex Sans for UI and names, IBM Plex Mono for all times. Plex Mono with `font-variant-numeric: tabular-nums` is non-negotiable for the time cells: times in a grid must align vertically on the digit, or scanning a column for a gap stops working. This is a legibility requirement, not a stylistic one.

**Signature element — the coverage strip.** Under each day column, a thin 24-hour horizontal bar showing which hours have someone assigned, filling in live as shifts are chosen. Uncovered hours render in `--alert`.

This is the whole reason to build the app rather than keep using Excel. A spreadsheet can hold the same data; it cannot show you that nobody is covering 3AM–7AM on the second Thursday. Build this in Phase 3 and keep everything around it plain — it should be the only visually loud thing on the page, and it should print.

---

## 7. Persistence

- Autosave the whole `Schedule` to `localStorage` on change, debounced ~300ms.
- Key: `shift-scheduler:v1:current`
- **Guard the load.** Validate the parsed shape and `version`; on any failure, fall back to a fresh schedule and don't throw. A half-written or hand-edited blob should never white-screen the app. Treat localStorage as untrusted input — because it is.
- Sharing is a **view-only link**, not a file: the schedule is encoded into the URL hash (`#r=…`) by a compact, dependency-free codec (`src/lib/shareCodec.ts`) and opened read-only (`SharedRosterView`). The originally-planned JSON export/import was dropped. To reuse a fortnight, keep the printed PDF or the link, or use **Copy week 1 → 2**.

---

## 8. Phases

Ship each phase as a working, committed state. Do not start the next until print preview passes.

### Phase 1 — Working Excel replacement

- `types.ts`, `constants.ts`, `scheduleReducer.ts` with full test coverage
- `lib/dates.ts` and `lib/time.ts` with tests
- Desktop table: sticky header row, sticky name column, add/remove/rename people
- `ShiftCell` with start + relative-duration dropdowns and the state selector (shift/off/PTO/holiday/empty)
- Toolbar: week-start date picker (snaps to Monday), 1-or-2 week toggle, Print, Copy week 1 → 2
- Print CSS, verified in Chrome preview
- localStorage autosave with guarded load

**Done when:** you can build a real fortnight end to end, print it to PDF, refresh the page, and find your work intact.

### Phase 2 — Reach and polish

- Mobile layout: below `md`, collapse to per-person cards (name → 7 stacked day rows). Same state, second rendering.
- JSON export / import
- Total hours column per person per week

### Phase 3 — The things Excel can't do

- Coverage strip (§6)
- Rule warnings, soft yellow, never blocking: uncovered hour, 7+ consecutive days, no rest between an overnight and the next morning shift, weekly hours over a configurable cap
- Shift presets for one-tap fill of the common rotations
- Undo/redo (trivial now — push reducer states onto a stack)

---

## 9. Testing

Vitest. The reducer and `lib/` are pure functions, so this is fast and needs no DOM.

**`scheduleReducer`:**

- `ADD_PERSON` then `SET_ASSIGNMENT` — existing assignments untouched
- `REMOVE_PERSON` prunes exactly that person's keys and no others
- `COPY_WEEK_1_TO_2` maps day indices 0–6 → 7–13, overwriting week 2 completely
- `SET_WEEK_COUNT` 2 → 1 → 2 preserves week-2 assignments
- `RENAME_PERSON` doesn't disturb assignment keys (this is the test that proves IDs, not indices, are the identity)

**`lib/dates.ts`:**

- `mondayOf('2026-07-29')` → `'2026-07-27'`
- `mondayOf` of a Monday returns that same Monday
- `parseISODateLocal('2026-07-27').getDate() === 27` — run with `TZ=America/Toronto` in the test script; this is the DST/UTC regression test and it will fail if someone "simplifies" the parser back to `new Date(iso)`

**`lib/time.ts`:**

- `start = 1380, duration = 480` formats as `11:00 PM – 7:00 AM`
- A shift ending exactly at midnight renders `12:00 AM`, not `24:00`

Skip component tests for v1. The bugs live in the reducer and the date math.

---

## 10. Guardrails for Claude Code

See [CLAUDE.md](./CLAUDE.md) at the repo root — the project invariants live there so
they survive across sessions.

**How to drive the sessions:** one phase per session, one commit per phase. Start each with _"Read PLAN.md and CLAUDE.md, then implement Phase N. Stop and show me the reducer tests before building UI."_ Front-loading the tests on a pure function is cheap, and it forces the data model to be settled before any component depends on its shape.
