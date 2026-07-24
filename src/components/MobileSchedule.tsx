import type { Dispatch } from 'react';
import type { Person, Schedule, ShiftPreset } from '../types.ts';
import type { Action } from '../state/scheduleReducer.ts';
import type { DisplayMode } from '../state/DisplayModeContext.tsx';
import { cellKey, getAssignment } from '../state/scheduleReducer.ts';
import { useSchedule } from '../state/ScheduleContext.tsx';
import { useDisplayMode } from '../state/DisplayModeContext.tsx';
import { usePresets } from '../state/PresetsContext.tsx';
import { DAYS_PER_WEEK } from '../constants.ts';
import { addDays, formatDateRange, formatDayHeader } from '../lib/dates.ts';
import { formatHours, summarizePerson } from '../lib/hours.ts';
import { duplicateNameKeys, normalizeName } from '../lib/people.ts';
import { fillClass } from './shiftFill.ts';
import { ShiftControls } from './ShiftControls.tsx';

interface PersonCardProps {
  person: Person;
  schedule: Schedule;
  dispatch: Dispatch<Action>;
  displayMode: DisplayMode;
  presets: ShiftPreset[];
  isDuplicate: boolean;
}

function PersonCard({
  person,
  schedule,
  dispatch,
  displayMode,
  presets,
  isDuplicate,
}: PersonCardProps) {
  const { startDate, weekCount } = schedule;
  const summary = summarizePerson(schedule, person.id);

  return (
    <article className="overflow-hidden rounded-sm border border-rule bg-paper">
      <header className="flex items-center gap-2 border-b border-rule px-3 py-2">
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
          className={`min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-ink/40 focus-visible:ring-2 focus-visible:ring-inset ${
            isDuplicate
              ? 'ring-1 ring-alert focus-visible:ring-alert'
              : 'focus-visible:ring-ink/50'
          }`}
        />
        {isDuplicate && (
          <span
            title="Another person already has this name"
            aria-label="Duplicate name"
            className="shrink-0 text-sm font-bold text-alert"
          >
            !
          </span>
        )}
        <span className="shrink-0 font-mono text-xs text-ink/60">
          {formatHours(summary.totalMinutes)}
        </span>
        <button
          type="button"
          aria-label={`Remove ${person.name || 'person'}`}
          onClick={() => dispatch({ type: 'REMOVE_PERSON', id: person.id })}
          className="shrink-0 rounded px-2 py-1 text-lg leading-none text-ink/40 hover:bg-ink/5 hover:text-ink focus-visible:ring-2 focus-visible:ring-ink/50"
        >
          ×
        </button>
      </header>

      {Array.from({ length: weekCount }, (_, week) => {
        const weekStart = addDays(startDate, week * DAYS_PER_WEEK);
        const weekEnd = addDays(
          startDate,
          week * DAYS_PER_WEEK + DAYS_PER_WEEK - 1,
        );
        return (
          <div key={week}>
            <div className="border-b border-rule bg-ink/[0.04] px-3 py-1 text-xs font-semibold text-ink/70">
              Week {week + 1} · {formatDateRange(weekStart, weekEnd)}
            </div>
            {Array.from({ length: DAYS_PER_WEEK }, (_, offset) => {
              const dayIndex = week * DAYS_PER_WEEK + offset;
              const header = formatDayHeader(addDays(startDate, dayIndex));
              const assignment = getAssignment(schedule, person.id, dayIndex);
              return (
                <div
                  key={dayIndex}
                  data-cellkey={cellKey(person.id, dayIndex)}
                  className={`flex items-stretch border-b border-rule last:border-b-0 ${fillClass(assignment, displayMode)}`}
                >
                  <div className="flex w-24 shrink-0 flex-col justify-center px-3 py-1">
                    <span className="text-sm font-semibold leading-tight">
                      {header.weekday}
                    </span>
                    <span className="font-mono text-xs leading-tight opacity-80">
                      {header.date}
                    </span>
                  </div>
                  <div className="flex-1 border-l border-black/10">
                    <ShiftControls
                      personId={person.id}
                      dayIndex={dayIndex}
                      assignment={assignment}
                      dispatch={dispatch}
                      presets={presets}
                      cellLabel={`${person.name || 'Unnamed'} — ${header.weekday} ${header.date}`}
                      size="comfortable"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </article>
  );
}

/** The phone layout: one card per person, days stacked as full-width rows. */
export function MobileSchedule() {
  const { schedule, dispatch } = useSchedule();
  const { displayMode } = useDisplayMode();
  const { presets } = usePresets();
  const dupes = duplicateNameKeys(schedule.people.map((p) => p.name));

  return (
    <div className="space-y-4">
      {schedule.people.map((person) => (
        <PersonCard
          key={person.id}
          person={person}
          schedule={schedule}
          dispatch={dispatch}
          displayMode={displayMode}
          presets={presets}
          isDuplicate={dupes.has(normalizeName(person.name))}
        />
      ))}
    </div>
  );
}
