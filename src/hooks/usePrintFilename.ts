import { useEffect, useRef } from 'react';

/** `2026-07-24 14-30` — safe for filenames (no colons), sortable, human-readable. */
function timestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    ` ${pad(now.getHours())}-${pad(now.getMinutes())}`
  );
}

/**
 * The browser's "Save as PDF" dialog names the file after `document.title`. Keep
 * the tab showing the clean title day-to-day, but stamp the title with the date
 * and time only while printing — so the saved file is e.g.
 * "Front Desk — 2026-07-24 14-30.pdf" and each export is uniquely named.
 */
export function usePrintFilename(title: string): void {
  const titleRef = useRef(title);
  titleRef.current = title;

  useEffect(() => {
    const before = () => {
      document.title = `${titleRef.current} — ${timestamp()}`;
    };
    const after = () => {
      document.title = titleRef.current;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);
}
