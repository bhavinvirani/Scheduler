# Shift Schedule Builder

A single-page, no-backend web app for building bi-weekly shift schedules and
printing them straight to PDF. Type names down the left, pick a start time and a
shift length per day, and print. No account, no server — your data lives in your
browser's `localStorage`.

> **Why not a spreadsheet?** A spreadsheet can hold the same data; it can't show
> you that nobody is covering 3AM–7AM on the second Thursday. That live coverage
> view (Phase 3) is the whole point.

## Tech

Vite · React 18 · TypeScript (strict) · Tailwind CSS · Vitest. Static build,
deployed to GitHub Pages via GitHub Actions.

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

## Scripts

| Command              | What it does                                        |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Start the Vite dev server                           |
| `npm run build`      | Type-check and build to `dist/`                     |
| `npm run preview`    | Serve the production build locally                  |
| `npm test`           | Run the unit tests (pinned to `TZ=America/Toronto`) |
| `npm run test:watch` | Run tests in watch mode                             |
| `npm run typecheck`  | Type-check without emitting                         |
| `npm run lint`       | Lint with ESLint                                    |
| `npm run format`     | Format with Prettier                                |

## How it's built

The plan and its rationale live in [PLAN.md](./PLAN.md); the non-negotiable
invariants for contributors (and AI assistants) live in [CLAUDE.md](./CLAUDE.md).
Business logic is a pure reducer (`src/state/scheduleReducer.ts`) plus pure
helpers (`src/lib/`), all unit-tested without a DOM.

## Deployment

Pushing to `main` runs the test suite, builds the site, and publishes it to
GitHub Pages (`.github/workflows/deploy.yml`). Enable Pages → "GitHub Actions"
in the repository settings once, and every green push deploys.

## License

MIT
