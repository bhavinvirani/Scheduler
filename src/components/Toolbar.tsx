import { useState } from 'react';
import { useSchedule } from '../state/ScheduleContext.tsx';
import { useDisplayMode } from '../state/DisplayModeContext.tsx';
import { useView } from '../state/ViewContext.tsx';
import { useViolations } from '../state/useViolations.ts';
import { useUndoRedoShortcuts } from '../hooks/useUndoRedoShortcuts.ts';
import { ConfirmDialog } from './ConfirmDialog.tsx';
import { PresetManager } from './PresetManager.tsx';
import { RulesManager } from './RulesManager.tsx';
import { BackupManager } from './BackupManager.tsx';
import { PrintDialog } from './PrintDialog.tsx';
import { ShareModal } from './ShareModal.tsx';

const buttonBase =
  'inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 ' +
  'focus-visible:ring-ink/60 disabled:cursor-not-allowed disabled:opacity-40';

const primaryButton = `${buttonBase} bg-ink text-paper hover:bg-ink/85`;
const secondaryButton = `${buttonBase} border border-rule bg-paper text-ink hover:bg-ink/5`;

// Label sitting above a segmented control in the settings row.
const fieldLabel = 'flex flex-col gap-1 text-xs font-medium text-ink/60';
const segmentGroup =
  'inline-flex overflow-hidden rounded-sm border border-rule';
const segmentButton =
  'px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/60';

function segmentState(active: boolean): string {
  return active ? 'bg-ink text-paper' : 'bg-paper text-ink hover:bg-ink/5';
}

export function Toolbar() {
  const { schedule, dispatch, canUndo, canRedo, undo, redo } = useSchedule();
  const { displayMode, setDisplayMode } = useDisplayMode();
  const { view, setView } = useView();
  const violations = useViolations();
  const { startDate, weekCount, people } = schedule;
  const canCopyWeek = weekCount === 2 && people.length > 0;
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  useUndoRedoShortcuts(undo, redo);

  const handleClear = () => {
    // Nothing to clear — don't pop a dialog over an empty grid.
    if (Object.keys(schedule.assignments).length === 0) return;
    setConfirmClearOpen(true);
  };

  const handlePrintChoice = (includeSummary: boolean) => {
    setPrintOpen(false);
    // Toggle the print scope on <html> synchronously, then print. `print.css`
    // hides the hours page while `print-schedule-only` is set; afterprint clears
    // it so the on-screen document and the next print aren't affected.
    const root = document.documentElement;
    root.classList.toggle('print-schedule-only', !includeSummary);
    window.addEventListener(
      'afterprint',
      () => root.classList.remove('print-schedule-only'),
      { once: true },
    );
    // Let the dialog unmount before the print preview paints.
    requestAnimationFrame(() => window.print());
  };

  return (
    <>
      <header className="no-print sticky top-0 z-30 border-b border-rule bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 md:px-6">
          {/* Row 1 — identity + schedule/display settings. */}
          <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
            <div className="mr-auto">
              <h1 className="text-base font-semibold leading-tight">
                Shift Schedule Builder
              </h1>
              <p className="text-xs text-ink/50">
                Autosaved to this browser · print for PDF
              </p>
            </div>

            <label className={fieldLabel}>
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

            <div className={fieldLabel}>
              Length
              <div
                role="group"
                aria-label="Number of weeks"
                className={segmentGroup}
              >
                {([1, 2] as const).map((count) => (
                  <button
                    key={count}
                    type="button"
                    aria-pressed={weekCount === count}
                    onClick={() => dispatch({ type: 'SET_WEEK_COUNT', count })}
                    className={`${segmentButton} ${segmentState(weekCount === count)}`}
                  >
                    {count} {count === 1 ? 'week' : 'weeks'}
                  </button>
                ))}
              </div>
            </div>

            <span
              aria-hidden="true"
              className="hidden h-9 w-px self-end bg-rule sm:block"
            />

            <div className={fieldLabel}>
              View
              <div role="group" aria-label="View" className={segmentGroup}>
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
                    className={`${segmentButton} ${segmentState(view === mode)}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className={fieldLabel}>
              Colors
              <div
                role="group"
                aria-label="Color mode"
                className={segmentGroup}
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
                        ? 'Black & white, best for printing'
                        : 'Color shifts by time of day'
                    }
                    className={`${segmentButton} ${segmentState(displayMode === mode)}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2 — actions. Undo/Redo lead; Print/PDF anchors the right. */}
          <div className="flex flex-wrap items-center gap-2 border-t border-rule pt-3">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (⌘Z / Ctrl+Z)"
              className={secondaryButton}
            >
              <span aria-hidden="true">↶</span> Undo
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (⇧⌘Z / Ctrl+Y)"
              className={secondaryButton}
            >
              <span aria-hidden="true">↷</span> Redo
            </button>

            <span
              aria-hidden="true"
              className="mx-1 h-6 w-px self-center bg-rule"
            />

            <button
              type="button"
              onClick={() => dispatch({ type: 'ADD_PERSON' })}
              className={primaryButton}
            >
              + Add person
            </button>
            <button
              type="button"
              onClick={() => setPresetsOpen(true)}
              title="Manage one-tap fill presets"
              className={secondaryButton}
            >
              Presets…
            </button>
            <button
              type="button"
              onClick={() => setRulesOpen(true)}
              title="Set up coverage and rule checks"
              className={secondaryButton}
            >
              Rules…
              {violations.length > 0 && (
                <span
                  aria-label={`${violations.length} rule warnings`}
                  className="ml-0.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-alert px-1 text-xs font-semibold text-paper"
                >
                  {violations.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setBackupOpen(true)}
              title="Save or restore a backup file"
              className={secondaryButton}
            >
              Backup…
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
              onClick={() => setShareOpen(true)}
              disabled={people.length === 0}
              title={
                people.length === 0
                  ? 'Add someone first'
                  : 'Get a view-only link to share'
              }
              className={`${secondaryButton} ml-auto`}
            >
              Share link
            </button>
            <button
              type="button"
              onClick={() => setPrintOpen(true)}
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
        message="This removes every shift and status from the grid. People stay on the schedule. You can undo it with ⌘Z."
        confirmLabel="Clear shifts"
        cancelLabel="Cancel"
        onConfirm={() => {
          dispatch({ type: 'CLEAR_ALL' });
          setConfirmClearOpen(false);
        }}
        onCancel={() => setConfirmClearOpen(false)}
      />

      <PresetManager open={presetsOpen} onClose={() => setPresetsOpen(false)} />

      <RulesManager open={rulesOpen} onClose={() => setRulesOpen(false)} />

      <BackupManager open={backupOpen} onClose={() => setBackupOpen(false)} />

      <PrintDialog
        open={printOpen}
        onChoose={handlePrintChoice}
        onCancel={() => setPrintOpen(false)}
      />

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />
    </>
  );
}
