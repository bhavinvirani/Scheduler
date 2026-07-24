import type { Dispatch } from 'react';
import type { Person, Rule, RuleType } from '../types.ts';
import type { RulePatch, RulesAction } from '../state/rulesReducer.ts';
import { useRules } from '../state/RulesContext.tsx';
import { useSchedule } from '../state/ScheduleContext.tsx';
import { Modal } from './Modal.tsx';
import { RULE_TYPE_META, RULE_TYPE_ORDER } from './ruleDisplay.ts';

const primaryBtn =
  'rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink/85 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ink/60';
const secondaryBtn =
  'rounded-sm border border-rule bg-paper px-3 py-1.5 text-sm font-medium text-ink ' +
  'hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60';
const fieldSelect =
  'rounded-sm border border-rule bg-paper px-1.5 py-1 text-sm text-ink ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ink/50';
const numberField =
  'w-16 rounded-sm border border-rule bg-paper px-1.5 py-1 text-sm text-ink ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ink/50';

interface RulesManagerProps {
  open: boolean;
  onClose: () => void;
}

/** The catalog + editor for user-defined scheduling rules. */
export function RulesManager({ open, onClose }: RulesManagerProps) {
  const { rules, dispatch } = useRules();
  const { schedule } = useSchedule();

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="rules-manager-title"
      describedBy="rules-manager-desc"
      className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-sm border border-rule bg-paper p-5"
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <h2 id="rules-manager-title" className="text-base font-semibold">
          Rules
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 rounded px-2 text-lg leading-none text-ink/50 hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/50"
        >
          ×
        </button>
      </div>
      <p id="rules-manager-desc" className="mb-4 text-sm text-ink/60">
        Turn on the checks you want and set the numbers. Warnings show on screen
        only, never on the printout.
      </p>

      {rules.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule px-4 py-8 text-center text-sm text-ink/60">
          No rules yet. Add one below to start checking your roster.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {rules.map((rule) => (
            <RuleRow
              key={rule.id}
              rule={rule}
              people={schedule.people}
              dispatch={dispatch}
            />
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
        <label className="flex items-center gap-2 text-sm font-medium text-ink">
          Add rule
          <select
            aria-label="Add a rule"
            value=""
            onChange={(event) => {
              const ruleType = event.target.value as RuleType;
              if (ruleType) dispatch({ type: 'ADD_RULE', ruleType });
              event.target.value = '';
            }}
            className={fieldSelect}
          >
            <option value="">Choose a rule…</option>
            {RULE_TYPE_ORDER.map((type) => (
              <option key={type} value={type}>
                {RULE_TYPE_META[type].label}
              </option>
            ))}
          </select>
        </label>
        {rules.length > 0 && (
          <button
            type="button"
            onClick={() => dispatch({ type: 'CLEAR_RULES' })}
            className={secondaryBtn}
          >
            Clear all
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className={`${primaryBtn} ml-auto`}
        >
          Done
        </button>
      </div>
    </Modal>
  );
}

function RuleRow({
  rule,
  people,
  dispatch,
}: {
  rule: Rule;
  people: Person[];
  dispatch: Dispatch<RulesAction>;
}) {
  const update = (patch: RulePatch) =>
    dispatch({ type: 'UPDATE_RULE', id: rule.id, patch });

  return (
    <li className="rounded-sm border border-rule px-3 py-2.5">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={rule.enabled}
          aria-label={`Enable ${RULE_TYPE_META[rule.type].label}`}
          onChange={(event) => update({ enabled: event.target.checked })}
          className="h-4 w-4 shrink-0 accent-ink"
        />
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-ink">
          <RuleParams rule={rule} update={update} />
        </div>
        <button
          type="button"
          aria-label={`Delete ${RULE_TYPE_META[rule.type].label} rule`}
          title="Delete rule"
          onClick={() => dispatch({ type: 'REMOVE_RULE', id: rule.id })}
          className="shrink-0 rounded px-2 py-1 text-lg leading-none text-ink/40 hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/50"
        >
          ×
        </button>
      </div>

      {rule.type !== 'coverageMin' && (
        <ScopeControl rule={rule} people={people} update={update} />
      )}
    </li>
  );
}

/** The number + unit + qualifier controls specific to each rule type. */
function RuleParams({
  rule,
  update,
}: {
  rule: Rule;
  update: (patch: RulePatch) => void;
}) {
  switch (rule.type) {
    case 'coverageMin':
      return (
        <>
          <span>At least</span>
          <NumberInput
            value={rule.minPeople}
            min={1}
            max={99}
            label="Minimum people working"
            onChange={(minPeople) => update({ minPeople })}
          />
          <span>people working</span>
          <select
            aria-label="Which days"
            value={rule.days}
            onChange={(event) =>
              update({ days: event.target.value as typeof rule.days })
            }
            className={fieldSelect}
          >
            <option value="all">every day</option>
            <option value="weekdays">on weekdays</option>
            <option value="weekends">on weekends</option>
          </select>
        </>
      );
    case 'restHours':
      return (
        <>
          <span>At least</span>
          <NumberInput
            value={rule.minHours}
            min={0}
            max={48}
            label="Minimum rest hours"
            onChange={(minHours) => update({ minHours })}
          />
          <span>hours rest between shifts</span>
        </>
      );
    case 'weeklyHoursMax':
      return (
        <>
          <span>No more than</span>
          <NumberInput
            value={rule.maxHours}
            min={0}
            max={168}
            label="Maximum weekly hours"
            onChange={(maxHours) => update({ maxHours })}
          />
          <span>hours per week</span>
        </>
      );
    case 'weeklyHoursMin':
      return (
        <>
          <span>At least</span>
          <NumberInput
            value={rule.minHours}
            min={0}
            max={168}
            label="Minimum weekly hours"
            onChange={(minHours) => update({ minHours })}
          />
          <span>hours per week</span>
        </>
      );
    case 'consecutiveDaysMax':
      return (
        <>
          <span>No more than</span>
          <NumberInput
            value={rule.maxDays}
            min={1}
            max={14}
            label="Maximum consecutive days"
            onChange={(maxDays) => update({ maxDays })}
          />
          <span>days in a row</span>
        </>
      );
    case 'shiftsPerWeekMax':
      return (
        <>
          <span>No more than</span>
          <NumberInput
            value={rule.maxShifts}
            min={0}
            max={7}
            label="Maximum shifts per week"
            onChange={(maxShifts) => update({ maxShifts })}
          />
          <span>shifts per week</span>
        </>
      );
    case 'daysOffPerWeekMin':
      return (
        <>
          <span>At least</span>
          <NumberInput
            value={rule.minDays}
            min={0}
            max={7}
            label="Minimum days off per week"
            onChange={(minDays) => update({ minDays })}
          />
          <span>days off per week</span>
        </>
      );
  }
}

function NumberInput({
  value,
  min,
  max,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value}
      min={min}
      max={max}
      aria-label={label}
      onChange={(event) => {
        const next = Number(event.target.value);
        // Ignore an empty or non-numeric transient; clamp real values in range.
        if (event.target.value === '' || !Number.isFinite(next)) return;
        onChange(Math.min(max, Math.max(min, Math.round(next))));
      }}
      className={numberField}
    />
  );
}

/** "Applies to everyone" or a checklist of specific people, for per-person rules. */
function ScopeControl({
  rule,
  people,
  update,
}: {
  // Every rule except coverageMin carries a `scope`.
  rule: Exclude<Rule, { type: 'coverageMin' }>;
  people: Person[];
  update: (patch: RulePatch) => void;
}) {
  const scope = rule.scope;
  const selectedIds = scope.kind === 'people' ? new Set(scope.ids) : null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-rule/60 pt-2 text-xs text-ink/70">
      <span className="font-medium">Applies to</span>
      <select
        aria-label="Applies to"
        value={scope.kind}
        onChange={(event) =>
          update({
            scope:
              event.target.value === 'people'
                ? {
                    kind: 'people',
                    ids: scope.kind === 'people' ? scope.ids : [],
                  }
                : { kind: 'all' },
          })
        }
        className={fieldSelect}
      >
        <option value="all">everyone</option>
        <option value="people">specific people</option>
      </select>

      {scope.kind === 'people' &&
        (people.length === 0 ? (
          <span className="text-ink/50">Add people to the schedule first.</span>
        ) : (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {people.map((person) => (
              <label
                key={person.id}
                className="flex items-center gap-1 whitespace-nowrap"
              >
                <input
                  type="checkbox"
                  checked={selectedIds?.has(person.id) ?? false}
                  onChange={(event) => {
                    const ids = new Set(selectedIds ?? []);
                    if (event.target.checked) ids.add(person.id);
                    else ids.delete(person.id);
                    update({ scope: { kind: 'people', ids: [...ids] } });
                  }}
                  className="h-3.5 w-3.5 accent-ink"
                />
                {person.name.trim() || 'Unnamed'}
              </label>
            ))}
          </div>
        ))}
    </div>
  );
}
