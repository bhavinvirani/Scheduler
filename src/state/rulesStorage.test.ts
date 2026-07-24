import { describe, it, expect } from 'vitest';
import type { Rule } from '../types.ts';
import {
  deserializeRules,
  isValidRule,
  serializeRules,
} from './rulesStorage.ts';

const restRule: Rule = {
  id: 'r1',
  type: 'restHours',
  enabled: true,
  minHours: 11,
  scope: { kind: 'all' },
};

const coverageRule: Rule = {
  id: 'r2',
  type: 'coverageMin',
  enabled: false,
  minPeople: 2,
  days: 'weekdays',
};

const peopleScopedRule: Rule = {
  id: 'r3',
  type: 'weeklyHoursMax',
  enabled: true,
  maxHours: 40,
  scope: { kind: 'people', ids: ['p1', 'p2'] },
};

describe('isValidRule — untrusted input', () => {
  it('accepts well-formed rules of each shape', () => {
    expect(isValidRule(restRule)).toBe(true);
    expect(isValidRule(coverageRule)).toBe(true);
    expect(isValidRule(peopleScopedRule)).toBe(true);
  });

  it('rejects an unknown rule type', () => {
    expect(isValidRule({ ...restRule, type: 'nope' })).toBe(false);
  });

  it('rejects missing or mistyped common fields', () => {
    expect(isValidRule({ ...restRule, id: 42 })).toBe(false);
    expect(isValidRule({ ...restRule, enabled: 'yes' })).toBe(false);
  });

  it('rejects out-of-range parameters', () => {
    expect(isValidRule({ ...restRule, minHours: -1 })).toBe(false);
    expect(isValidRule({ ...restRule, minHours: 999 })).toBe(false);
    expect(isValidRule({ ...coverageRule, minPeople: 0 })).toBe(false);
    expect(isValidRule({ ...coverageRule, days: 'mondays' })).toBe(false);
  });

  it('rejects a malformed scope', () => {
    expect(isValidRule({ ...restRule, scope: { kind: 'some' } })).toBe(false);
    expect(
      isValidRule({ ...restRule, scope: { kind: 'people', ids: [1, 2] } }),
    ).toBe(false);
  });
});

describe('serialize / deserialize', () => {
  it('round-trips a rule list', () => {
    const rules = [restRule, coverageRule, peopleScopedRule];
    expect(deserializeRules(serializeRules(rules))).toEqual(rules);
  });

  it('treats an empty list as valid', () => {
    expect(deserializeRules('[]')).toEqual([]);
  });

  it('returns null for missing, non-JSON, non-array, or corrupt data', () => {
    expect(deserializeRules(null)).toBeNull();
    expect(deserializeRules('{')).toBeNull();
    expect(deserializeRules('{"not":"array"}')).toBeNull();
    expect(deserializeRules('[{"type":"restHours"}]')).toBeNull();
  });
});
