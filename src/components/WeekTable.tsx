import { DAYS_PER_WEEK } from '../constants.ts';
import { addDays, formatDateRange, formatDayHeader } from '../lib/dates.ts';
import { useSchedule } from '../state/ScheduleContext.tsx';
import { useDisplayMode } from '../state/DisplayModeContext.tsx';
import { PersonRow } from './PersonRow.tsx';

interface WeekTableProps {
  /** 0 for the first week, 1 for the second. */
  weekIndex: number;
}

/** Names (normalized) that more than one person shares — used to flag duplicates. */
function duplicateNames(names: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const raw of names) {
    const key = raw.trim().toLowerCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dupes = new Set<string>();
  for (const [key, count] of counts) if (count > 1) dupes.add(key);
  return dupes;
}

export function WeekTable({ weekIndex }: WeekTableProps) {
  const { schedule, dispatch } = useSchedule();
  const { displayMode } = useDisplayMode();
  const { startDate, people } = schedule;
  const firstDay = weekIndex * DAYS_PER_WEEK;
  const weekStart = addDays(startDate, firstDay);
  const weekEnd = addDays(startDate, firstDay + DAYS_PER_WEEK - 1);
  const dupes = duplicateNames(people.map((p) => p.name));
  const isDuplicate = (name: string) => dupes.has(name.trim().toLowerCase());

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
                const header = formatDayHeader(
                  addDays(startDate, firstDay + offset),
                );
                return (
                  <th
                    key={offset}
                    scope="col"
                    className="sticky top-0 z-10 min-w-[8rem] border border-rule border-b-ink/80 bg-paper px-2 py-1 text-center"
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
                isDuplicate={isDuplicate(person.name)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
