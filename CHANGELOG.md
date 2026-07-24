# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-07-24

### Added

- **Backup and restore.** Save the whole setup (schedule, presets, and rules) to
  a single versioned JSON file and restore it on any browser or device — no
  backend, nothing uploaded. On Chrome and Edge you can connect a file that
  auto-saves on every change; drop it in a synced folder (Drive, Dropbox, iCloud)
  for cross-device use. `localStorage` stays primary; the file is a mirror and
  recovery source, and the app offers to load a file that is newer than this
  browser rather than overwriting silently.

## [1.2.0] - 2026-07-24

### Added

- **User-defined rule checks.** Turn on your own checks and the roster flags
  whatever breaks them, on screen only: minimum daily coverage, minimum rest
  between shifts, weekly-hours cap and floor, maximum consecutive days, maximum
  shifts per week, and minimum days off per week. Each is configurable and can
  apply to everyone or to specific people. Warnings list in a panel (click to
  jump), mark the offending cells, and flag under-covered day headers — never on
  the printout.

## [1.1.0] - 2026-07-24

### Added

- **Print scope choice.** Print / PDF now asks whether to include just the
  schedule (one page) or the schedule plus the hours page (two pages).
- Scheduling a person is blocked until they have a name, so a blank row can't be
  filled in by mistake.

### Changed

- Releases are now cut automatically on a successful deploy (version derived from
  conventional commits), so the published version always matches what is live.

## [1.0.0] - 2026-07-24

First public release: a complete, no-backend shift-roster builder that prints to
PDF.

### Added

- Two-week (or one-week) shift grid with a sticky name column and day headers.
- Shifts stored as start time plus length, so overnight shifts are unambiguous
  and the hours always add up.
- Off / PTO / Holiday day statuses.
- Reusable, editable shift presets with one-tap fill from the cell menu, plus
  desktop click-to-paint across the grid.
- Undo and redo with keyboard shortcuts; the changed cell flashes and scrolls
  into view.
- An hours summary page (hours per person per week, the fortnight total,
  Off/PTO/Holiday counts, and a blank Notes column) that prints as page 2.
- Color (by time of day) or black-and-white display.
- Print to PDF via the browser at A4 landscape; the file is named with the
  title and date.
- Mobile card layout for editing on a phone.
- Autosave to `localStorage`; works fully offline.
- Share a **view-only** link: the schedule is encoded in the URL hash and opens
  read-only, without touching the viewer's own saved data.
- Copy week 1 to week 2.

### Project

- Apache-2.0 licensed; deployed to GitHub Pages via GitHub Actions with the test
  suite gating each deploy.
- Search-engine and social metadata (Open Graph, Twitter cards, JSON-LD,
  sitemap, web manifest) and a social preview image.
- Privacy-friendly, cookieless analytics (GoatCounter): no cookies, no personal
  data.
- Contribution setup: `CONTRIBUTING.md`, issue and pull-request templates,
  `CODEOWNERS`, a CI workflow, and protected `main`.

[1.3.0]: https://github.com/bhavinvirani/Scheduler/releases/tag/v1.3.0
[1.2.0]: https://github.com/bhavinvirani/Scheduler/releases/tag/v1.2.0
[1.1.0]: https://github.com/bhavinvirani/Scheduler/releases/tag/v1.1.0
[1.0.0]: https://github.com/bhavinvirani/Scheduler/releases/tag/v1.0.0
