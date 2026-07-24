import { DAYS_PER_WEEK } from '../constants.ts';
import { addDays, formatDateRange, formatDayHeader } from '../lib/dates.ts';
import { useSchedule } from '../state/ScheduleContext.tsx';
import { PersonRow } from './PersonRow.tsx';

interface WeekTableProps {
  /** 0 for the first week, 1 for the second. */
  weekIndex: number;
}

export function WeekTable({ weekIndex }: WeekTableProps) {
  const { schedule, dispatch } = useSchedule();
  const { startDate, people } = schedule;
  const firstDay = weekIndex * DAYS_PER_WEEK;
  const weekStart = addDays(startDate, firstDay);
  const weekEnd = addDays(startDate, firstDay + DAYS_PER_WEEK - 1);

  return (
    <section className="week-table">
      <h2 className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold">
        Week {weekIndex + 1}
        <span className="font-mono text-xs font-normal text-ink/60">
          {formatDateRange(weekStart, weekEnd)}
        </span>
      </h2>

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
                    className="sticky top-0 z-10 min-w-[7.5rem] border border-rule border-b-ink/80 bg-paper px-2 py-1 text-center"
                  >
                    <span className="block text-xs font-semibold">
                      {header.weekday}
                    </span>
                    <span className="block font-mono text-xs tabular-nums text-ink/60">
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
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
