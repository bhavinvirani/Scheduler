import type { Dispatch } from 'react';
import type { Person, Schedule, ShiftPreset } from '../types.ts';
import type { Action } from '../state/scheduleReducer.ts';
import type { DisplayMode } from '../state/DisplayModeContext.tsx';
import { cellKey, getAssignment } from '../state/scheduleReducer.ts';
import { DAYS_PER_WEEK } from '../constants.ts';
import { addDays, formatDayHeader } from '../lib/dates.ts';
import { ShiftCell } from './ShiftCell.tsx';

interface PersonRowProps {
  person: Person;
  /** 0 for the first week, 1 for the second. */
  weekIndex: number;
  startDate: string;
  schedule: Schedule;
  dispatch: Dispatch<Action>;
  displayMode: DisplayMode;
  /** The preset library, for the cell menu's one-tap fills. */
  presets: ShiftPreset[];
  /** The armed paint preset (or null) — click-to-fill on each day cell. */
  armedPreset: ShiftPreset | null;
  /** True when another person shares this (non-empty) name. */
  isDuplicate: boolean;
  /** Shared view-only roster: render the name static, no input or remove. */
  readOnly?: boolean;
  /** Cell keys currently flagged by a rule warning, for the --alert ring. */
  alertedCells?: ReadonlySet<string>;
}

export function PersonRow({
  person,
  weekIndex,
  startDate,
  schedule,
  dispatch,
  displayMode,
  presets,
  armedPreset,
  isDuplicate,
  readOnly = false,
  alertedCells,
}: PersonRowProps) {
  const firstDay = weekIndex * DAYS_PER_WEEK;

  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-10 border border-rule border-r-ink/70 bg-paper p-0 text-left"
      >
        {readOnly ? (
          <span className="block px-2 py-1 text-sm font-medium print:text-[9pt]">
            {person.name || '—'}
          </span>
        ) : (
          <>
            {/* Print: a plain name; inputs and the remove button are chrome. */}
            <span className="hidden px-2 py-1 text-[9pt] font-medium print:block">
              {person.name || '—'}
            </span>

            <div className="flex items-center gap-1 px-1 py-0.5 print:hidden">
              <input
                type="text"
                value={person.name}
                placeholder="Name"
                aria-label="Person name"
                aria-invalid={isDuplicate}
                onChange={(event) =>
                  dispatch({
                    type: 'RENAME_PERSON',
                    id: person.id,
                    name: event.target.value,
                  })
                }
                className={`w-32 min-w-0 flex-1 bg-transparent px-1 py-0.5 text-sm font-medium outline-none placeholder:text-ink/40 focus-visible:ring-2 focus-visible:ring-inset ${
                  isDuplicate
                    ? 'ring-1 ring-alert focus-visible:ring-alert'
                    : 'focus-visible:ring-ink/50'
                }`}
              />
              {isDuplicate && (
                <span
                  title="Another person already has this name"
                  aria-label="Duplicate name"
                  className="shrink-0 select-none px-0.5 text-sm font-bold text-alert"
                >
                  !
                </span>
              )}
              <button
                type="button"
                aria-label={`Remove ${person.name || 'person'}`}
                title="Remove"
                onClick={() =>
                  dispatch({ type: 'REMOVE_PERSON', id: person.id })
                }
                className="shrink-0 rounded px-1.5 text-ink/40 hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/50"
              >
                ×
              </button>
            </div>
          </>
        )}
      </th>

      {Array.from({ length: DAYS_PER_WEEK }, (_, offset) => {
        const dayIndex = firstDay + offset;
        const header = formatDayHeader(addDays(startDate, dayIndex));
        return (
          <ShiftCell
            key={dayIndex}
            personId={person.id}
            dayIndex={dayIndex}
            assignment={getAssignment(schedule, person.id, dayIndex)}
            dispatch={dispatch}
            displayMode={displayMode}
            presets={presets}
            armedPreset={armedPreset}
            cellLabel={`${person.name || 'Unnamed'} — ${header.weekday} ${header.date}`}
            readOnly={readOnly}
            disabled={!readOnly && person.name.trim() === ''}
            alerted={alertedCells?.has(cellKey(person.id, dayIndex)) ?? false}
          />
        );
      })}
    </tr>
  );
}
