import { useEffect } from 'react';
import { addDays, formatDateRange } from './lib/dates.ts';
import { DAYS_PER_WEEK, DEFAULT_SCHEDULE_TITLE } from './constants.ts';
import { ScheduleProvider, useSchedule } from './state/ScheduleContext.tsx';
import { DisplayModeProvider } from './state/DisplayModeContext.tsx';
import { Toolbar } from './components/Toolbar.tsx';
import { WeekTable } from './components/WeekTable.tsx';

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
  const { startDate, weekCount, people } = schedule;
  const lastDayIndex = weekCount * DAYS_PER_WEEK - 1;

  // Resolve the title (custom or default) and use it for the browser tab, which
  // is also what the printed PDF is titled / named by default.
  const effectiveTitle =
    (schedule.title ?? '').trim() || DEFAULT_SCHEDULE_TITLE;
  useEffect(() => {
    document.title = effectiveTitle;
  }, [effectiveTitle]);

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
      <header className="mb-5">
        {/* Print: the resolved title as the document heading. */}
        <h2 className="hidden text-lg font-semibold print:block">
          {effectiveTitle}
        </h2>
        {/* Screen: editable and optional — leave it blank for the default. */}
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
        <div className="space-y-8">
          {Array.from({ length: weekCount }, (_, weekIndex) => (
            <WeekTable key={weekIndex} weekIndex={weekIndex} />
          ))}
        </div>
      )}
    </main>
  );
}

export default function App() {
  return (
    <DisplayModeProvider>
      <ScheduleProvider>
        <div className="min-h-screen bg-paper font-sans text-ink">
          <Toolbar />
          <ScheduleDocument />
        </div>
      </ScheduleProvider>
    </DisplayModeProvider>
  );
}
