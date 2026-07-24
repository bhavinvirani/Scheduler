import { memo } from 'react';
import type { Dispatch } from 'react';
import type { Assignment } from '../types.ts';
import type { Action } from '../state/scheduleReducer.ts';
import type { DisplayMode } from '../state/DisplayModeContext.tsx';
import { DEFAULT_SHIFT_DURATION_MINUTES } from '../constants.ts';
import {
  assignmentLabel,
  durationOptions,
  shiftCategory,
  startOptions,
} from '../lib/time.ts';

// Static across every cell — build the 48 start options once, not per render.
const START_OPTIONS = startOptions();

const STATUS_OPTIONS = [
  { value: 'empty', label: '—' },
  { value: 'off', label: 'Off' },
  { value: 'pto', label: 'PTO' },
  { value: 'holiday', label: 'Holiday' },
] as const;

const SHIFT_FILL: Record<ReturnType<typeof shiftCategory>, string> = {
  day: 'bg-day text-white',
  evening: 'bg-evening text-white',
  night: 'bg-night text-white',
};

/**
 * Background + text color for a cell. In black-and-white mode every cell is
 * white with black text so it prints cleanly and the shift time stays legible;
 * color mode fills shifts by their time of day.
 */
function fillClass(assignment: Assignment, mode: DisplayMode): string {
  if (mode === 'mono') {
    if (assignment.kind === 'shift') return 'bg-white text-ink';
    if (assignment.kind === 'empty') return 'bg-white text-ink/40';
    return 'bg-white text-ink/60'; // off / pto / holiday — recessed
  }
  if (assignment.kind === 'shift')
    return SHIFT_FILL[shiftCategory(assignment.start)];
  if (assignment.kind === 'empty') return 'bg-paper text-ink/40';
  return 'bg-absent text-ink'; // off / pto / holiday
}

const selectClass =
  'w-full cursor-pointer appearance-none bg-transparent px-1.5 py-1 ' +
  'font-mono text-xs font-medium tabular-nums leading-tight outline-none ' +
  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/50';

interface ShiftCellProps {
  personId: string;
  dayIndex: number;
  assignment: Assignment;
  dispatch: Dispatch<Action>;
  displayMode: DisplayMode;
  /** Human context for screen readers, e.g. "Ada — Monday Jul 20". */
  cellLabel: string;
}

function ShiftCellComponent({
  personId,
  dayIndex,
  assignment,
  dispatch,
  displayMode,
  cellLabel,
}: ShiftCellProps) {
  const setValue = (value: Assignment) =>
    dispatch({ type: 'SET_ASSIGNMENT', personId, dayIndex, value });

  const handleStatusOrStart = (raw: string) => {
    if (raw.startsWith('t:')) {
      const start = Number(raw.slice(2));
      // Keep the current length when only the start moves; otherwise default to 8h.
      const duration =
        assignment.kind === 'shift'
          ? assignment.duration
          : DEFAULT_SHIFT_DURATION_MINUTES;
      setValue({ kind: 'shift', start, duration });
    } else if (raw === 'off' || raw === 'pto' || raw === 'holiday') {
      setValue({ kind: raw });
    } else {
      setValue({ kind: 'empty' });
    }
  };

  const primaryValue =
    assignment.kind === 'shift' ? `t:${assignment.start}` : assignment.kind;

  return (
    <td
      className={`border border-rule p-0 align-top ${fillClass(assignment, displayMode)}`}
    >
      {/* Print: the selects don't render reliably, so show a static label. */}
      <span className="hidden px-1.5 py-1 font-mono text-[8pt] font-medium leading-tight tabular-nums print:block">
        {assignmentLabel(assignment)}
      </span>

      {/* Screen: the editable controls. Times come first, then statuses. */}
      <div className="flex flex-col print:hidden">
        <select
          aria-label={`${cellLabel} — start time or status`}
          value={primaryValue}
          onChange={(event) => handleStatusOrStart(event.target.value)}
          className={selectClass}
        >
          <optgroup label="Start time">
            {START_OPTIONS.map((option) => (
              <option key={option.value} value={`t:${option.value}`}>
                {option.label}
              </option>
            ))}
          </optgroup>
          <optgroup label="Status">
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </optgroup>
        </select>

        {assignment.kind === 'shift' && (
          <select
            aria-label={`${cellLabel} — shift length`}
            value={assignment.duration}
            onChange={(event) =>
              setValue({
                kind: 'shift',
                start: assignment.start,
                duration: Number(event.target.value),
              })
            }
            className={`${selectClass} border-t border-black/10`}
          >
            {durationOptions(assignment.start).map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </td>
  );
}

/**
 * Memoized so a change to one cell doesn't re-render the other ~349. Relies on
 * `getAssignment` returning stable references (a shared frozen empty, and the
 * reducer preserving untouched assignment objects); `displayMode` changes rarely
 * and re-renders every cell by design.
 */
export const ShiftCell = memo(ShiftCellComponent);
