import { useEffect, useState } from 'react';
import { useSchedule } from '../state/ScheduleContext.tsx';

// Must outlast the longest cellFlash animation in index.css — 1.1s normally,
// 1.6s under prefers-reduced-motion. Stripping the class mid-animation would
// snap the ring away instead of letting it fade out.
const FLASH_MS = 1700;

/**
 * After an undo/redo, briefly pulses the cell(s) that changed and scrolls the
 * first one into view — so it's obvious WHERE the change landed. Works off
 * `data-cellkey` anchors on the grid cells and mobile rows, so it needs no prop
 * threading through the memoized cell tree. Renders nothing.
 */
export function UndoFlash() {
  const { flashedKeys, flashNonce, flashAction } = useSchedule();
  const [liveMessage, setLiveMessage] = useState('');

  useEffect(() => {
    if (flashNonce === 0 || flashedKeys.size === 0) return;

    // ponytail: plain "Undo"/"Redo" plus cell count; enough for SR users
    const label = flashAction === 'redo' ? 'Redo' : 'Undo';
    const n = flashedKeys.size;
    setLiveMessage(
      n === 1 ? `${label}: 1 cell updated` : `${label}: ${n} cells updated`,
    );

    const els: HTMLElement[] = [];
    flashedKeys.forEach((key) => {
      document
        .querySelectorAll<HTMLElement>(`[data-cellkey="${CSS.escape(key)}"]`)
        .forEach((el) => {
          // Only the visible layout regime (desktop grid OR mobile cards).
          if (el.offsetParent !== null) els.push(el);
        });
    });
    if (els.length === 0) return;

    for (const el of els) {
      el.classList.remove('cell-flash');
      void el.offsetWidth; // reflow so the animation restarts on a repeat undo
      el.classList.add('cell-flash');
    }
    els[0]!.scrollIntoView({ block: 'nearest', inline: 'nearest' });

    const timer = window.setTimeout(() => {
      for (const el of els) el.classList.remove('cell-flash');
    }, FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [flashNonce, flashedKeys, flashAction]);

  return (
    <div className="sr-only" aria-live="polite" aria-atomic="true">
      {liveMessage}
    </div>
  );
}
