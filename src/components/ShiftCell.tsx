import { memo } from 'react';
import type { Dispatch } from 'react';
import type { Assignment } from '../types.ts';
import type { Action } from '../state/scheduleReducer.ts';
import type { DisplayMode } from '../state/DisplayModeContext.tsx';
import { assignmentLabel } from '../lib/time.ts';
import { fillClass } from './shiftFill.ts';
import { ShiftControls } from './ShiftControls.tsx';

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
  return (
    <td
      className={`border border-rule p-0 align-top ${fillClass(assignment, displayMode)}`}
    >
      {/* Print: the selects don't render reliably, so show a static label. */}
      <span className="hidden px-1.5 py-1 font-mono text-[8pt] font-medium leading-tight tabular-nums print:block">
        {assignmentLabel(assignment)}
      </span>

      {/* Screen: the editable controls. */}
      <div className="print:hidden">
        <ShiftControls
          personId={personId}
          dayIndex={dayIndex}
          assignment={assignment}
          dispatch={dispatch}
          cellLabel={cellLabel}
        />
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
