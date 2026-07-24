import type { Violation } from '../lib/rules.ts';

const FLASH_MS = 1700; // matches the cellFlash animation (see index.css)

/** The first on-screen element a violation points at: a cell, else a day header. */
function anchorFor(violation: Violation): HTMLElement | null {
  const visible = (el: Element | null): HTMLElement | null =>
    el instanceof HTMLElement && el.offsetParent !== null ? el : null;

  for (const key of violation.cellKeys) {
    const el = visible(
      document.querySelector(`[data-cellkey="${CSS.escape(key)}"]`),
    );
    if (el) return el;
  }
  for (const day of violation.dayIndices) {
    const el = visible(document.querySelector(`[data-dayindex="${day}"]`));
    if (el) return el;
  }
  return null;
}

/** Scroll the offending spot into view and pulse it, reusing the undo-flash. */
function jumpTo(violation: Violation) {
  const el = anchorFor(violation);
  if (!el) return;
  el.scrollIntoView({ block: 'center', inline: 'nearest' });
  el.classList.remove('cell-flash');
  void el.offsetWidth; // reflow so a repeat click restarts the animation
  el.classList.add('cell-flash');
  window.setTimeout(() => el.classList.remove('cell-flash'), FLASH_MS);
}

/**
 * Screen-only list of the current rule violations. Uses the reserved `--alert`
 * channel (its intended purpose) and never prints. Clicking one scrolls to and
 * flashes the cells or day it concerns. Renders nothing when the roster is clean.
 */
export function WarningsPanel({ violations }: { violations: Violation[] }) {
  if (violations.length === 0) return null;

  return (
    <section
      aria-label="Rule warnings"
      className="no-print mb-5 rounded-sm border border-alert/40 bg-alert/[0.06]"
    >
      <h2 className="flex items-center gap-2 border-b border-alert/20 px-3 py-2 text-sm font-semibold text-alert">
        <span aria-hidden="true">!</span>
        {violations.length} rule{' '}
        {violations.length === 1 ? 'warning' : 'warnings'}
      </h2>
      <ul className="max-h-56 divide-y divide-alert/10 overflow-y-auto">
        {violations.map((violation, index) => (
          <li key={`${violation.ruleId}:${index}`}>
            <button
              type="button"
              onClick={() => jumpTo(violation)}
              className="block w-full px-3 py-1.5 text-left text-sm text-ink hover:bg-alert/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-alert/50"
            >
              {violation.message}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
