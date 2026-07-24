import type { Rule, RuleType } from '../types.ts';

/** Catalog metadata: the label and one-line description shown in the manager. */
export const RULE_TYPE_META: Record<
  RuleType,
  { label: string; blurb: string }
> = {
  coverageMin: {
    label: 'Daily coverage',
    blurb: 'At least N people working each day.',
  },
  restHours: {
    label: 'Rest between shifts',
    blurb: 'A minimum gap between one shift ending and the next starting.',
  },
  weeklyHoursMax: {
    label: 'Weekly hours cap',
    blurb: 'No more than N hours per person per week.',
  },
  weeklyHoursMin: {
    label: 'Weekly hours floor',
    blurb: 'At least N hours per person per week.',
  },
  consecutiveDaysMax: {
    label: 'Max days in a row',
    blurb: 'No more than N worked days back to back.',
  },
  shiftsPerWeekMax: {
    label: 'Max shifts per week',
    blurb: 'No more than N shifts per person per week.',
  },
  daysOffPerWeekMin: {
    label: 'Min days off per week',
    blurb: 'At least N days off per person per week.',
  },
};

/** The order rule types appear in the "add rule" menu. */
export const RULE_TYPE_ORDER: RuleType[] = [
  'coverageMin',
  'restHours',
  'weeklyHoursMax',
  'weeklyHoursMin',
  'consecutiveDaysMax',
  'shiftsPerWeekMax',
  'daysOffPerWeekMin',
];

/** A compact one-line summary of a configured rule, e.g. `Rest between shifts: ≥ 11h`. */
export function describeRule(rule: Rule): string {
  const { label } = RULE_TYPE_META[rule.type];
  switch (rule.type) {
    case 'coverageMin':
      return `${label}: ≥ ${rule.minPeople} (${rule.days})`;
    case 'restHours':
      return `${label}: ≥ ${rule.minHours}h`;
    case 'weeklyHoursMax':
      return `${label}: ≤ ${rule.maxHours}h`;
    case 'weeklyHoursMin':
      return `${label}: ≥ ${rule.minHours}h`;
    case 'consecutiveDaysMax':
      return `${label}: ≤ ${rule.maxDays} days`;
    case 'shiftsPerWeekMax':
      return `${label}: ≤ ${rule.maxShifts} shifts`;
    case 'daysOffPerWeekMin':
      return `${label}: ≥ ${rule.minDays} days`;
  }
}
