import { useSchedule } from '../state/ScheduleContext.tsx';
import { DAYS_PER_WEEK, DEFAULT_SCHEDULE_TITLE } from '../constants.ts';
import { addDays, formatDateRange } from '../lib/dates.ts';
import { formatHours, summarizePerson } from '../lib/hours.ts';

const numCell = 'px-3 py-1.5 text-right font-mono text-sm tabular-nums';
const headCell =
  'px-3 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-ink/70';
// Off/PTO/Holiday are single digits — keep them tight so hours and the notes column get room.
const countNum = 'px-2 py-1.5 text-right font-mono text-sm tabular-nums';
const countHead =
  'px-2 py-1.5 text-right text-xs font-semibold uppercase tracking-wide text-ink/70';
// A blank, non-editable column for handwritten notes on the printed page.
const notesCell = 'min-w-[13rem] border-l border-rule px-3 py-1.5';

export function SummaryView() {
  const { schedule } = useSchedule();
  const { people, weekCount, startDate } = schedule;
  const lastDayIndex = weekCount * DAYS_PER_WEEK - 1;
  const effectiveTitle =
    (schedule.title ?? '').trim() || DEFAULT_SCHEDULE_TITLE;
  const showTotal = weekCount > 1;

  const rows = people.map((person) => ({
    person,
    summary: summarizePerson(schedule, person.id),
  }));

  const teamWeekMinutes = Array.from({ length: weekCount }, (_, week) =>
    rows.reduce((sum, row) => sum + (row.summary.weekMinutes[week] ?? 0), 0),
  );
  const teamTotalMinutes = teamWeekMinutes.reduce((sum, m) => sum + m, 0);

  return (
    <section>
      <header className="mb-4">
        <h2 className="text-lg font-semibold">
          {effectiveTitle} — Hours Summary
        </h2>
        <p className="font-mono text-sm text-ink/60">
          {formatDateRange(startDate, addDays(startDate, lastDayIndex))}
        </p>
      </header>

      {people.length === 0 ? (
        <p className="text-sm text-ink/60">
          Add people on the Grid to see their hours here.
        </p>
      ) : (
        <div className="scroll-x overflow-x-auto border border-rule">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-ink/80">
                <th className="px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-ink/70">
                  Name
                </th>
                {Array.from({ length: weekCount }, (_, week) => (
                  <th key={week} className={headCell}>
                    Week {week + 1}
                  </th>
                ))}
                {showTotal && <th className={headCell}>Total</th>}
                <th className={`${countHead} border-l border-rule`}>Off</th>
                <th className={countHead}>PTO</th>
                <th className={countHead}>Holiday</th>
                <th
                  className={`${notesCell} text-left text-xs font-semibold uppercase tracking-wide text-ink/70`}
                >
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ person, summary }) => (
                <tr key={person.id} className="border-b border-rule">
                  <td className="px-3 py-1.5 text-sm font-medium">
                    {person.name || '—'}
                  </td>
                  {summary.weekMinutes.map((minutes, week) => (
                    <td key={week} className={numCell}>
                      {formatHours(minutes)}
                    </td>
                  ))}
                  {showTotal && (
                    <td className={`${numCell} font-semibold`}>
                      {formatHours(summary.totalMinutes)}
                    </td>
                  )}
                  <td className={`${countNum} border-l border-rule`}>
                    {summary.offDays}
                  </td>
                  <td className={countNum}>{summary.ptoDays}</td>
                  <td className={countNum}>{summary.holidayDays}</td>
                  <td className={notesCell} />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-ink/80">
                <th className="px-3 py-1.5 text-left text-sm font-semibold">
                  Team total
                </th>
                {teamWeekMinutes.map((minutes, week) => (
                  <td key={week} className={`${numCell} font-semibold`}>
                    {formatHours(minutes)}
                  </td>
                ))}
                {showTotal && (
                  <td className={`${numCell} font-semibold`}>
                    {formatHours(teamTotalMinutes)}
                  </td>
                )}
                <td className={`${countNum} border-l border-rule`} />
                <td className={countNum} />
                <td className={countNum} />
                <td className={notesCell} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
