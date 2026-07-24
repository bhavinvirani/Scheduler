# Contributing

Thanks for helping improve Shift Schedule Builder. It is a small, no-backend
static app, and a few conventions keep it that way.

## Ground rules

Please skim the invariants in [CLAUDE.md](./CLAUDE.md) before you start. In short:
no backend, no database, no export libraries (printing is the browser plus
`@media print` CSS), shifts are stored as `{ start, duration }`, and the `alert`
colour is reserved for warnings. Pull requests that break these will be asked to
change.

## Getting set up

```bash
npm install
npm run dev
```

Run the full check before you push:

```bash
npm run typecheck && npm run lint && npm test
```

## Branching and pull requests

`main` is protected. It always stays green and deployable, and every change lands
through a pull request; direct pushes to `main` are turned off.

1. Branch off `main` with a short, descriptive name, for example
   `fix/overnight-hours` or `feat/shift-notes`.
2. Make your change. Add or update a test for anything that changes behaviour;
   the reducers and helpers are written test-first.
3. Open a pull request against `main`. CI (typecheck, lint, tests, build) must
   pass, and the branch must be up to date with `main`.
4. Keep pull requests small and focused. They get reviewed faster that way.

History stays linear, so pull requests are squash-merged.

## Commit messages

Keep the subject in the imperative and under about 72 characters, for example
`fix: count an overnight shift in its starting week`. A short body explaining the
why is welcome for anything non-trivial.

## Reporting bugs and ideas

Use the issue templates for a
[bug report](.github/ISSUE_TEMPLATE/bug_report.yml) or a
[feature request](.github/ISSUE_TEMPLATE/feature_request.yml). Reproducing on the
[live app](https://bhavinvirani.github.io/Scheduler/) first helps a lot.
