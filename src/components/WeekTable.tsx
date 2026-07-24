import { DAYS_PER_WEEK } from '../constants.ts';
import { addDays, formatDateRange, formatDayHeader } from '../lib/dates.ts';
import { duplicateNameKeys, normalizeName } from '../lib/people.ts';
import { useSchedule } from '../state/ScheduleContext.tsx';
import { useDisplayMode } from '../state/DisplayModeContext.tsx';
import { usePresets } from '../state/PresetsContext.tsx';
import { usePaint } from '../state/PaintContext.tsx';
import { PersonRow } from './PersonRow.tsx';

interface WeekTableProps {
  /** 0 for the first week, 1 for the second. */
  weekIndex: number;
  /** Cell keys flagged by a rule warning (the --alert ring). */
  alertedCells?: ReadonlySet<string>;
  /** Day indices whose header should show an under-coverage marker. */
  alertedDays?: ReadonlySet<number>;
}

export function WeekTable({
  weekIndex,
  alertedCells,
  alertedDays,
}: WeekTableProps) {
  const { schedule, dispatch, readOnly } = useSchedule();
  const { displayMode } = useDisplayMode();
  const { presets } = usePresets();
  const { armedPresetId } = usePaint();
  const armedPreset =
    presets.find((preset) => preset.id === armedPresetId) ?? null;
  const { startDate, people } = schedule;
  const firstDay = weekIndex * DAYS_PER_WEEK;
  const weekStart = addDays(startDate, firstDay);
  const weekEnd = addDays(startDate, firstDay + DAYS_PER_WEEK - 1);
  const dupes = duplicateNameKeys(people.map((p) => p.name));
  const isDuplicate = (name: string) => dupes.has(normalizeName(name));

  return (
    <section className="week-table">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-3 border-b-2 border-ink/80 pb-1">
        <h2 className="text-base font-bold">Week {weekIndex + 1}</h2>
        <span className="font-mono text-sm font-semibold text-ink">
          {formatDateRange(weekStart, weekEnd)}
        </span>
      </div>

      <div className="scroll-x overflow-x-auto border border-rule">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-20 min-w-[9rem] border border-rule border-b-ink/80 border-r-ink/70 bg-paper px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-ink/70"
              >
                Name
              </th>
              {Array.from({ length: DAYS_PER_WEEK }, (_, offset) => {
                const dayIndex = firstDay + offset;
                const header = formatDayHeader(addDays(startDate, dayIndex));
                const dayAlerted = alertedDays?.has(dayIndex) ?? false;
                return (
                  <th
                    key={offset}
                    scope="col"
                    data-dayindex={dayIndex}
                    title={dayAlerted ? 'Below required coverage' : undefined}
                    className={`sticky top-0 z-10 min-w-[8rem] border border-rule border-b-ink/80 bg-paper px-2 py-1 text-center${
                      dayAlerted ? ' day-alert' : ''
                    }`}
                  >
                    <span className="block text-sm font-semibold">
                      {header.weekday}
                    </span>
                    <span className="block font-mono text-xs tabular-nums text-ink/70">
                      {header.date}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                weekIndex={weekIndex}
                startDate={startDate}
                schedule={schedule}
                dispatch={dispatch}
                displayMode={displayMode}
                presets={presets}
                armedPreset={armedPreset}
                isDuplicate={isDuplicate(person.name)}
                readOnly={readOnly}
                alertedCells={alertedCells}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
