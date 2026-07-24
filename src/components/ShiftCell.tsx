import { memo } from 'react';
import type { Dispatch } from 'react';
import type { Assignment, ShiftPreset } from '../types.ts';
import type { Action } from '../state/scheduleReducer.ts';
import type { DisplayMode } from '../state/DisplayModeContext.tsx';
import { cellKey } from '../state/scheduleReducer.ts';
import { assignmentLabel } from '../lib/time.ts';
import { fillClass } from './shiftFill.ts';
import { presetLabel } from './presetDisplay.ts';
import { ShiftControls } from './ShiftControls.tsx';

interface ShiftCellProps {
  personId: string;
  dayIndex: number;
  assignment: Assignment;
  dispatch: Dispatch<Action>;
  displayMode: DisplayMode;
  /** The preset library, offered as one-tap fills in the cell menu. */
  presets: ShiftPreset[];
  /** When set, one click paints this preset instead of opening the menu. */
  armedPreset: ShiftPreset | null;
  /** Human context for screen readers, e.g. "Ada — Monday Jul 20". */
  cellLabel: string;
  /** In a shared view-only roster the cell is a static label, not editable. */
  readOnly?: boolean;
}

function ShiftCellComponent({
  personId,
  dayIndex,
  assignment,
  dispatch,
  displayMode,
  presets,
  armedPreset,
  cellLabel,
  readOnly = false,
}: ShiftCellProps) {
  const tdClass = `border border-rule p-0 align-top ${fillClass(assignment, displayMode)}`;

  if (readOnly) {
    return (
      <td data-cellkey={cellKey(personId, dayIndex)} className={tdClass}>
        <div className="px-1.5 py-1 font-mono text-xs font-medium leading-tight tabular-nums print:text-[8pt]">
          {assignmentLabel(assignment) || ' '}
        </div>
      </td>
    );
  }

  return (
    <td data-cellkey={cellKey(personId, dayIndex)} className={tdClass}>
      {/* Print: the selects don't render reliably, so show a static label. */}
      <span className="hidden px-1.5 py-1 font-mono text-[8pt] font-medium leading-tight tabular-nums print:block">
        {assignmentLabel(assignment)}
      </span>

      {/* Screen: paint target when a preset is armed, else the editable controls. */}
      <div className="print:hidden">
        {armedPreset ? (
          <button
            type="button"
            onClick={() =>
              dispatch({
                type: 'SET_ASSIGNMENT',
                personId,
                dayIndex,
                value: {
                  kind: 'shift',
                  start: armedPreset.start,
                  duration: armedPreset.duration,
                },
              })
            }
            title={`Fill ${presetLabel(armedPreset)}`}
            aria-label={`Fill ${presetLabel(armedPreset)} into ${cellLabel}`}
            className="block min-h-[2.25rem] w-full cursor-crosshair px-1.5 py-1 text-left font-mono text-xs font-medium leading-tight tabular-nums hover:bg-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/50"
          >
            {assignmentLabel(assignment) || ' '}
          </button>
        ) : (
          <ShiftControls
            personId={personId}
            dayIndex={dayIndex}
            assignment={assignment}
            dispatch={dispatch}
            presets={presets}
            cellLabel={cellLabel}
          />
        )}
      </div>
    </td>
  );
}

/**
 * Memoized so a change to one cell doesn't re-render the other ~349. Relies on
 * `getAssignment` returning stable references (a shared frozen empty, and the
 * reducer preserving untouched assignment objects). `displayMode`, `presets`,
 * `armedPreset`, and `readOnly` change rarely and re-render every cell by design.
 */
export const ShiftCell = memo(ShiftCellComponent);
