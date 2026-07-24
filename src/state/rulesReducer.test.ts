import { describe, it, expect } from 'vitest';
import type { Rule } from '../types.ts';
import { createRule, rulesReducer } from './rulesReducer.ts';

describe('createRule', () => {
  it('creates each catalog type enabled with sane defaults and a fresh id', () => {
    const rest = createRule('restHours');
    expect(rest).toMatchObject({
      type: 'restHours',
      enabled: true,
      minHours: 11,
    });
    expect(rest.id).toMatch(/[0-9a-f-]{36}/);

    const coverage = createRule('coverageMin');
    expect(coverage).toMatchObject({
      type: 'coverageMin',
      minPeople: 1,
      days: 'all',
    });
    // Two rules of the same type never share an id.
    expect(createRule('restHours').id).not.toBe(rest.id);
  });
});

describe('rulesReducer', () => {
  it('ADD_RULE appends a configured rule of the requested type', () => {
    const next = rulesReducer([], {
      type: 'ADD_RULE',
      ruleType: 'weeklyHoursMax',
    });
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ type: 'weeklyHoursMax', maxHours: 40 });
  });

  it('UPDATE_RULE patches only the named rule and only the given fields', () => {
    const a = createRule('restHours');
    const b = createRule('weeklyHoursMax');
    const next = rulesReducer([a, b], {
      type: 'UPDATE_RULE',
      id: a.id,
      patch: { minHours: 8, enabled: false },
    });
    expect(next[0]).toMatchObject({ id: a.id, minHours: 8, enabled: false });
    expect(next[1]).toBe(b); // untouched rule keeps its reference
  });

  it('REMOVE_RULE drops the rule by id', () => {
    const a = createRule('restHours');
    const b = createRule('coverageMin');
    expect(rulesReducer([a, b], { type: 'REMOVE_RULE', id: a.id })).toEqual([
      b,
    ]);
  });

  it('CLEAR_RULES empties the list', () => {
    const rules: Rule[] = [createRule('restHours'), createRule('coverageMin')];
    expect(rulesReducer(rules, { type: 'CLEAR_RULES' })).toEqual([]);
  });
});
