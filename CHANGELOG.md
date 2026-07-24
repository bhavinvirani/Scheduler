# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/bhavinvirani/Scheduler/releases/tag/v1.0.0
