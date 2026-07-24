import { addDays, formatDateRange } from './lib/dates.ts';
import { DAYS_PER_WEEK } from './constants.ts';
import { ScheduleProvider, useSchedule } from './state/ScheduleContext.tsx';
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
  const { schedule } = useSchedule();
  const { startDate, weekCount, people } = schedule;
  const lastDayIndex = weekCount * DAYS_PER_WEEK - 1;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-6">
      <header className="mb-5">
        <h2 className="text-lg font-semibold">Shift Schedule</h2>
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
    <ScheduleProvider>
      <div className="min-h-screen bg-paper font-sans text-ink">
        <Toolbar />
        <ScheduleDocument />
      </div>
    </ScheduleProvider>
  );
}
