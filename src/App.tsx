import { useEffect, useMemo } from 'react';
import type { Schedule } from './types.ts';
import { addDays, formatDateRange } from './lib/dates.ts';
import { DAYS_PER_WEEK, DEFAULT_SCHEDULE_TITLE } from './constants.ts';
import {
  ScheduleProvider,
  ReadOnlyScheduleProvider,
  useSchedule,
} from './state/ScheduleContext.tsx';
import { DisplayModeProvider } from './state/DisplayModeContext.tsx';
import { ViewProvider, useView } from './state/ViewContext.tsx';
import { PresetsProvider } from './state/PresetsContext.tsx';
import { PaintProvider } from './state/PaintContext.tsx';
import { RulesProvider } from './state/RulesContext.tsx';
import { useViolations } from './state/useViolations.ts';
import { decodeShare } from './lib/shareCodec.ts';
import { usePrintFilename } from './hooks/usePrintFilename.ts';
import { Toolbar } from './components/Toolbar.tsx';
import { WeekTable } from './components/WeekTable.tsx';
import { MobileSchedule } from './components/MobileSchedule.tsx';
import { PaintBar } from './components/PaintBar.tsx';
import { UndoFlash } from './components/UndoFlash.tsx';
import { WarningsPanel } from './components/WarningsPanel.tsx';
import { SummaryView } from './components/SummaryView.tsx';
import { SharedRosterView } from './components/SharedRosterView.tsx';

function EmptyState() {
  const { dispatch } = useSchedule();
  return (
    <div className="mt-10 border border-dashed border-rule bg-paper px-6 py-16 text-center">
      <p className="text-sm text-ink/60">
        No one on the schedule yet. Add a person to start building the
        fortnight.
      </p>
      <button
        type="button"
        onClick={() => dispatch({ type: 'ADD_PERSON' })}
        className="mt-4 inline-flex rounded-sm bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60"
      >
        + Add the first person
      </button>
    </div>
  );
}

function ScheduleDocument() {
  const { schedule, dispatch } = useSchedule();
  const { view } = useView();
  const { startDate, weekCount, people } = schedule;
  const lastDayIndex = weekCount * DAYS_PER_WEEK - 1;

  // Rule warnings, and the cells / day headers to mark with the --alert channel.
  const violations = useViolations();
  const alertedCells = useMemo(
    () => new Set(violations.flatMap((violation) => violation.cellKeys)),
    [violations],
  );
  const alertedDays = useMemo(
    () =>
      new Set(
        violations
          .filter((violation) => violation.ruleType === 'coverageMin')
          .flatMap((violation) => violation.dayIndices),
      ),
    [violations],
  );

  // The printed document's title (custom, or the schedule default).
  const customTitle = (schedule.title ?? '').trim();
  const effectiveTitle = customTitle || DEFAULT_SCHEDULE_TITLE;
  // The browser tab — and the title search engines render — shows the app name
  // until the user names their schedule, which is clearer than the bare default.
  const tabTitle = customTitle || 'Shift Schedule Builder';
  useEffect(() => {
    document.title = tabTitle;
  }, [tabTitle]);
  // Stamp the PDF filename with date + time at print; restore the tab title after.
  usePrintFilename(effectiveTitle, tabTitle);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
      {/* Rule warnings — screen only, above the document. */}
      <WarningsPanel violations={violations} />

      {/* Page-1 document title: shown on the Grid view and always in print. */}
      <header className={`mb-5 ${view === 'grid' ? '' : 'hidden'} print:block`}>
        <h2 className="hidden text-lg font-semibold print:block">
          {effectiveTitle}
        </h2>
        <input
          type="text"
          value={schedule.title ?? ''}
          placeholder={DEFAULT_SCHEDULE_TITLE}
          aria-label="Schedule title (optional)"
          onChange={(event) =>
            dispatch({ type: 'SET_TITLE', title: event.target.value })
          }
          className="w-full max-w-xl bg-transparent text-lg font-semibold outline-none placeholder:text-ink/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/40 print:hidden"
        />
        <p className="font-mono text-sm text-ink/60">
          {formatDateRange(startDate, addDays(startDate, lastDayIndex))}
        </p>
      </header>

      {people.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Schedule view. Prints as page 1 regardless of the on-screen tab. */}
          <section className={`${view === 'grid' ? '' : 'hidden'} print:block`}>
            <PaintBar />
            <div className="hidden space-y-8 md:block print:block">
              {Array.from({ length: weekCount }, (_, weekIndex) => (
                <WeekTable
                  key={weekIndex}
                  weekIndex={weekIndex}
                  alertedCells={alertedCells}
                  alertedDays={alertedDays}
                />
              ))}
            </div>
            <div className="md:hidden print:hidden">
              <MobileSchedule alertedCells={alertedCells} />
            </div>
          </section>

          {/* Hours summary. Prints on a fresh page (page 2) after the schedule,
              unless the download dialog chose "schedule only" (see print.css). */}
          <section
            className={`summary-print break-before-page ${view === 'summary' ? '' : 'hidden'} print:block`}
          >
            <SummaryView />
          </section>
        </>
      )}
    </main>
  );
}

/** A shared roster to display read-only, decoded from a `#r=` link — or null. */
function readSharedSchedule(): Schedule | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#r=')) return null;
  return decodeShare(hash.slice(3));
}

export default function App() {
  // Decoded once on mount: a valid `#r=` link opens the read-only shared view,
  // which never touches localStorage. Anything else is the normal editor.
  const shared = useMemo(readSharedSchedule, []);

  if (shared) {
    return (
      <DisplayModeProvider>
        <ViewProvider>
          <PresetsProvider>
            <PaintProvider>
              <ReadOnlyScheduleProvider schedule={shared}>
                <SharedRosterView />
              </ReadOnlyScheduleProvider>
            </PaintProvider>
          </PresetsProvider>
        </ViewProvider>
      </DisplayModeProvider>
    );
  }

  return (
    <DisplayModeProvider>
      <ViewProvider>
        <PresetsProvider>
          <PaintProvider>
            <ScheduleProvider>
              <RulesProvider>
                <div className="min-h-screen bg-paper font-sans text-ink">
                  <Toolbar />
                  <ScheduleDocument />
                  <UndoFlash />
                </div>
              </RulesProvider>
            </ScheduleProvider>
          </PaintProvider>
        </PresetsProvider>
      </ViewProvider>
    </DisplayModeProvider>
  );
}
