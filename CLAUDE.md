# Shift Schedule Builder

A single-page, no-backend web app for building bi-weekly shift schedules and
printing them to PDF. Full spec lives in [PLAN.md](./PLAN.md).

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # tsc -b && vite build (production build to dist/)
npm run preview      # preview the production build
npm test             # vitest run, pinned to TZ=America/Toronto
npm run test:watch   # vitest in watch mode
npm run typecheck    # tsc -b (type-check only)
npm run lint         # eslint
npm run format       # prettier --write .
```

Tests run under `TZ=America/Toronto` on purpose — that is the DST/UTC
regression environment for the date parser. Do not remove the `TZ` prefix.

## Project invariants — do not violate

- No backend, no auth, no database. Static site only.
- PDF output is browser print + `@media print` CSS. Do NOT add jsPDF,
  html2canvas, docx, SheetJS, or any export library.
- Shifts are stored as `{ start: Minutes, duration: Minutes }`.
  Never `{ start, end }`. Never a `Date` object.
- Assignments are keyed by `` `${personId}:${dayIndex}` ``. Person identity is a
  UUID. Array index is never an identity anywhere in this codebase.
- Calendar dates are ISO strings. Parse with `parseISODateLocal()`, never
  `new Date(isoString)` — that parses as UTC and shifts the day.
- All state mutation goes through `scheduleReducer`. No `setState` scattered
  across components.
- One component tree. No separate print view.
- `--alert` (`#C2410C`, Tailwind `alert`) is reserved for coverage gaps and
  rule warnings. Never use it for buttons, hovers, or decoration.
- Verify Chrome print preview before calling any phase complete.

## Architecture

See [PLAN.md §4](./PLAN.md). In short: `useReducer` + context, pure reducer in
`src/state/scheduleReducer.ts`, pure helpers in `src/lib/`, one component tree
with two CSS regimes (screen + print).

Shared rosters are **view-only links**: `src/lib/shareCodec.ts` encodes the
schedule into the URL hash (`#r=…`) with a compact, dependency-free codec, and
`App` opens it read-only via `ReadOnlyScheduleProvider` + `SharedRosterView`
(grid only, no summary). Because it's hash-based it needs no server-side routing
(works on plain GitHub Pages) and never writes to `localStorage`; a decoded link
is untrusted and re-validated with `isValidSchedule`.
