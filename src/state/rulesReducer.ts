import type { CoverageDays, Rule, RuleScope, RuleType } from '../types.ts';

/**
 * Rules are their own tiny domain, like presets — a flat, ordered list edited
 * through a pure reducer and stored under a separate key, so managing rules
 * never touches the schedule or its undo history. Rules are user-defined: the
 * catalog below is the menu of types a manager can add and then configure.
 */

/** Mutable fields a rule row can patch. Flat across every rule type; the UI only
 *  ever sends fields that exist on the rule it is editing. */
export interface RulePatch {
  enabled?: boolean;
  minPeople?: number;
  minHours?: number;
  maxHours?: number;
  minDays?: number;
  maxDays?: number;
  maxShifts?: number;
  days?: CoverageDays;
  scope?: RuleScope;
}

export type RulesAction =
  | { type: 'ADD_RULE'; ruleType: RuleType }
  | { type: 'UPDATE_RULE'; id: string; patch: RulePatch }
  | { type: 'REMOVE_RULE'; id: string }
  | { type: 'CLEAR_RULES' };

const ALL: RuleScope = { kind: 'all' };

/** A freshly added rule of `ruleType`, enabled with sensible starting values. */
export function createRule(ruleType: RuleType): Rule {
  const id = crypto.randomUUID();
  switch (ruleType) {
    case 'coverageMin':
      return { id, type: ruleType, enabled: true, minPeople: 1, days: 'all' };
    case 'restHours':
      return { id, type: ruleType, enabled: true, minHours: 11, scope: ALL };
    case 'weeklyHoursMax':
      return { id, type: ruleType, enabled: true, maxHours: 40, scope: ALL };
    case 'weeklyHoursMin':
      return { id, type: ruleType, enabled: true, minHours: 20, scope: ALL };
    case 'consecutiveDaysMax':
      return { id, type: ruleType, enabled: true, maxDays: 6, scope: ALL };
    case 'shiftsPerWeekMax':
      return { id, type: ruleType, enabled: true, maxShifts: 5, scope: ALL };
    case 'daysOffPerWeekMin':
      return { id, type: ruleType, enabled: true, minDays: 2, scope: ALL };
  }
}

/** Rules start empty — the manager is a menu the user builds from. */
export function createDefaultRules(): Rule[] {
  return [];
}

export function rulesReducer(state: Rule[], action: RulesAction): Rule[] {
  switch (action.type) {
    case 'ADD_RULE': {
      return [...state, createRule(action.ruleType)];
    }

    case 'UPDATE_RULE': {
      return state.map((rule) =>
        // The patch only carries fields valid for this rule's type (enforced by
        // the editor UI), so merging keeps the rule a well-formed union member.
        rule.id === action.id ? ({ ...rule, ...action.patch } as Rule) : rule,
      );
    }

    case 'REMOVE_RULE': {
      return state.filter((rule) => rule.id !== action.id);
    }

    case 'CLEAR_RULES': {
      return [];
    }
  }
}
