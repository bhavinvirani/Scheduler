import { useState } from 'react';
import { useSchedule } from '../state/ScheduleContext.tsx';
import { useDisplayMode } from '../state/DisplayModeContext.tsx';
import { useView } from '../state/ViewContext.tsx';
import { ConfirmDialog } from './ConfirmDialog.tsx';

const buttonBase =
  'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
  'focus-visible:ring-ink/60 disabled:cursor-not-allowed disabled:opacity-40';

const primaryButton = `${buttonBase} bg-ink text-paper hover:bg-ink/85`;
const secondaryButton = `${buttonBase} border border-rule bg-paper text-ink hover:bg-ink/5`;

export function Toolbar() {
  const { schedule, dispatch } = useSchedule();
  const { displayMode, setDisplayMode } = useDisplayMode();
  const { view, setView } = useView();
  const { startDate, weekCount, people } = schedule;
  const canCopyWeek = weekCount === 2 && people.length > 0;
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const handleClear = () => {
    // Nothing to clear — don't pop a dialog over an empty grid.
    if (Object.keys(schedule.assignments).length === 0) return;
    setConfirmClearOpen(true);
  };

  return (
    <>
      <header className="no-print sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end gap-x-6 gap-y-3 px-4 py-3 md:px-6">
          <div className="mr-auto">
            <h1 className="text-base font-semibold leading-tight">
              Shift Schedule Builder
            </h1>
            <p className="text-xs text-ink/50">
              Autosaved to this browser · print for PDF
            </p>
          </div>

          <label className="flex flex-col gap-1 text-xs font-medium text-ink/60">
            Week starts (Monday)
            <input
              type="date"
              value={startDate}
              aria-label="Week start date"
              onChange={(event) =>
                dispatch({ type: 'SET_START_DATE', iso: event.target.value })
              }
              className="rounded-sm border border-rule bg-paper px-2 py-1 font-mono text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ink/60"
            />
          </label>

          <div className="flex flex-col gap-1 text-xs font-medium text-ink/60">
            View
            <div
              role="group"
              aria-label="View"
              className="inline-flex overflow-hidden rounded-sm border border-rule"
            >
              {(
                [
                  ['grid', 'Grid'],
                  ['summary', 'Summary'],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={view === mode}
                  onClick={() => setView(mode)}
                  className={`px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/60 ${
                    view === mode
                      ? 'bg-ink text-paper'
                      : 'bg-paper text-ink hover:bg-ink/5'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs font-medium text-ink/60">
            Length
            <div
              role="group"
              aria-label="Number of weeks"
              className="inline-flex overflow-hidden rounded-sm border border-rule"
            >
              {([1, 2] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={weekCount === count}
                  onClick={() => dispatch({ type: 'SET_WEEK_COUNT', count })}
                  className={`px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/60 ${
                    weekCount === count
                      ? 'bg-ink text-paper'
                      : 'bg-paper text-ink hover:bg-ink/5'
                  }`}
                >
                  {count} {count === 1 ? 'week' : 'weeks'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1 text-xs font-medium text-ink/60">
            Colors
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
                  title={
                    mode === 'mono'
                      ? 'Black & white — best for printing'
                      : 'Color shifts by time of day'
                  }
                  className={`px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/60 ${
                    displayMode === mode
                      ? 'bg-ink text-paper'
                      : 'bg-paper text-ink hover:bg-ink/5'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => dispatch({ type: 'ADD_PERSON' })}
              className={primaryButton}
            >
              + Add person
            </button>
            <button
              type="button"
              onClick={() => dispatch({ type: 'COPY_WEEK_1_TO_2' })}
              disabled={!canCopyWeek}
              title={
                canCopyWeek
                  ? 'Copy week 1 onto week 2'
                  : 'Needs two weeks and at least one person'
              }
              className={secondaryButton}
            >
              Copy week 1 → 2
            </button>
            <button
              type="button"
              onClick={handleClear}
              className={secondaryButton}
            >
              Clear shifts
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className={primaryButton}
            >
              Print / PDF
            </button>
          </div>
        </div>
      </header>

      <ConfirmDialog
        open={confirmClearOpen}
        title="Clear all shifts?"
        message="This removes every shift and status from the grid. People stay on the schedule. This can’t be undone."
        confirmLabel="Clear shifts"
        cancelLabel="Cancel"
        onConfirm={() => {
          dispatch({ type: 'CLEAR_ALL' });
          setConfirmClearOpen(false);
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />
    </>
  );
}
