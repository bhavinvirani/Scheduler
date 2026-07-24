import { useEffect } from 'react';
import { DAYS_PER_WEEK, DEFAULT_SCHEDULE_TITLE } from '../constants.ts';
import { addDays, formatDateRange } from '../lib/dates.ts';
import { useSchedule } from '../state/ScheduleContext.tsx';
import { useDisplayMode } from '../state/DisplayModeContext.tsx';
import { usePrintFilename } from '../hooks/usePrintFilename.ts';
import { WeekTable } from './WeekTable.tsx';
import { MobileSchedule } from './MobileSchedule.tsx';

const segment =
  'px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/60';

function segmentState(active: boolean): string {
  return active ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-ink/5';
}

function SharedBanner({
  title,
  dateRange,
}: {
  title: string;
  dateRange: string;
}) {
  const { displayMode, setDisplayMode } = useDisplayMode();

  return (
    <header className="no-print sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-6">
        <div className="mr-auto">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-paper">
              View-only
            </span>
            <h1 className="text-base font-semibold leading-tight">{title}</h1>
          </div>
          <p className="font-mono text-xs text-ink/50">
            {dateRange} · shared roster
          </p>
        </div>

        <div
          role="group"
          aria-label="Color mode"
          className="inline-flex overflow-hidden rounded-sm border border-rule"
        >
          {(
            [
              ['color', 'Color'],
              ['mono', 'B&W'],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              type="button"
              aria-pressed={displayMode === mode}
              onClick={() => setDisplayMode(mode)}
              className={`${segment} ${segmentState(displayMode === mode)}`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ink/60"
        >
          Print / PDF
        </button>
      </div>
    </header>
  );
}

/**
 * The read-only page shown when a `#r=` share link is opened. Grid only — a
 * shared roster is a single-page schedule to view and print, no hours summary.
 */
export function SharedRosterView() {
  const { schedule } = useSchedule();
  const { startDate, weekCount } = schedule;
  const lastDayIndex = weekCount * DAYS_PER_WEEK - 1;
  const effectiveTitle =
    (schedule.title ?? '').trim() || DEFAULT_SCHEDULE_TITLE;
  const dateRange = formatDateRange(
    startDate,
    addDays(startDate, lastDayIndex),
  );

  useEffect(() => {
    document.title = effectiveTitle;
  }, [effectiveTitle]);
  usePrintFilename(effectiveTitle);

  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      <SharedBanner title={effectiveTitle} dateRange={dateRange} />

      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
        {/* Title header — print only (the banner carries it on screen). */}
        <header className="mb-5 hidden print:block">
          <h2 className="text-lg font-semibold">{effectiveTitle}</h2>
          <p className="font-mono text-sm text-ink/60">{dateRange}</p>
        </header>

        <div className="hidden space-y-8 md:block print:block">
          {Array.from({ length: weekCount }, (_, weekIndex) => (
            <WeekTable key={weekIndex} weekIndex={weekIndex} />
          ))}
        </div>
        <div className="md:hidden print:hidden">
          <MobileSchedule />
        </div>

        <footer className="no-print mt-10 text-center text-sm text-ink/50">
          Built with{' '}
          <a
            href="./"
            className="font-medium text-ink underline underline-offset-2 hover:text-ink/70"
          >
            Shift Schedule Builder
          </a>
          . Make your own for free.
        </footer>
      </main>
    </div>
  );
}
