import { describe, it, expect } from 'vitest';
import { initHistory, withHistory } from './history.ts';

// A tiny pure reducer to exercise the generic wrapper without dragging in the
// whole Schedule model. `noop` returns the same reference (a real no-op).
interface State {
  n: number;
  names: Record<string, string>;
}
type Action =
  | { type: 'inc' }
  | { type: 'rename'; id: string; name: string }
  | { type: 'reset'; n: number }
  | { type: 'noop' };

function counter(state: State, action: Action): State {
  switch (action.type) {
    case 'inc':
      return { ...state, n: state.n + 1 };
    case 'rename':
      return { ...state, names: { ...state.names, [action.id]: action.name } };
    case 'reset':
      return { n: action.n, names: {} };
    case 'noop':
      return state;
  }
}

const options = {
  isReset: (a: Action) => a.type === 'reset',
  coalesceKey: (a: Action) => (a.type === 'rename' ? `rename:${a.id}` : null),
};

const start: State = { n: 0, names: {} };

describe('withHistory', () => {
  it('records the prior state as an undo step on a change', () => {
    const reduce = withHistory(counter, options);
    const s1 = reduce(initHistory(start), { type: 'inc' });
    expect(s1.present).toEqual({ n: 1, names: {} });
    expect(s1.past).toEqual([{ n: 0, names: {} }]);
    expect(s1.future).toEqual([]);
  });

  it('undo restores the previous state and stashes the current one for redo', () => {
    const reduce = withHistory(counter, options);
    const s1 = reduce(initHistory(start), { type: 'inc' });
    const undone = reduce(s1, { type: 'UNDO' });
    expect(undone.present).toEqual({ n: 0, names: {} });
    expect(undone.past).toEqual([]);
    expect(undone.future).toEqual([{ n: 1, names: {} }]);
  });

  it('redo re-applies an undone state', () => {
    const reduce = withHistory(counter, options);
    const s1 = reduce(initHistory(start), { type: 'inc' });
    const redone = reduce(reduce(s1, { type: 'UNDO' }), { type: 'REDO' });
    expect(redone.present).toEqual({ n: 1, names: {} });
    expect(redone.past).toEqual([{ n: 0, names: {} }]);
    expect(redone.future).toEqual([]);
  });

  it('is a no-op to undo with an empty past or redo with an empty future', () => {
    const reduce = withHistory(counter, options);
    const base = initHistory(start);
    expect(reduce(base, { type: 'UNDO' })).toBe(base);
    expect(reduce(base, { type: 'REDO' })).toBe(base);
  });

  it('clears the redo stack when a new action is taken after undo', () => {
    const reduce = withHistory(counter, options);
    const s1 = reduce(initHistory(start), { type: 'inc' });
    const undone = reduce(s1, { type: 'UNDO' });
    const branched = reduce(undone, { type: 'inc' });
    expect(branched.present).toEqual({ n: 1, names: {} });
    expect(branched.future).toEqual([]);
  });

  it('does not record an action the reducer treats as a no-op', () => {
    const reduce = withHistory(counter, options);
    const s1 = reduce(initHistory(start), { type: 'inc' });
    const after = reduce(s1, { type: 'noop' });
    expect(after).toBe(s1);
  });

  it('resets history on a reset action (no undo across a load)', () => {
    const reduce = withHistory(counter, options);
    const s1 = reduce(initHistory(start), { type: 'inc' });
    const s2 = reduce(s1, { type: 'reset', n: 9 });
    expect(s2.present).toEqual({ n: 9, names: {} });
    expect(s2.past).toEqual([]);
    expect(s2.future).toEqual([]);
  });

  it('coalesces consecutive edits sharing a key into a single undo step', () => {
    const reduce = withHistory(counter, options);
    let s = initHistory(start);
    s = reduce(s, { type: 'rename', id: 'a', name: 'A' });
    s = reduce(s, { type: 'rename', id: 'a', name: 'Ab' });
    s = reduce(s, { type: 'rename', id: 'a', name: 'Abc' });
    expect(s.present.names).toEqual({ a: 'Abc' });
    // One undo jumps straight back to before the whole typing run.
    const undone = reduce(s, { type: 'UNDO' });
    expect(undone.present).toEqual({ n: 0, names: {} });
    expect(undone.past).toEqual([]);
  });

  it('does not coalesce edits with different keys', () => {
    const reduce = withHistory(counter, options);
    let s = initHistory(start);
    s = reduce(s, { type: 'rename', id: 'a', name: 'A' });
    s = reduce(s, { type: 'rename', id: 'b', name: 'B' });
    expect(s.past).toHaveLength(2);
  });

  it('does not coalesce an edit that resumes after an undo', () => {
    const reduce = withHistory(counter, options);
    let s = initHistory(start);
    s = reduce(s, { type: 'rename', id: 'a', name: 'A' });
    s = reduce(s, { type: 'UNDO' });
    s = reduce(s, { type: 'rename', id: 'a', name: 'A2' });
    // The post-undo edit starts a fresh step rather than merging into the old run.
    expect(s.past).toEqual([{ n: 0, names: {} }]);
    expect(s.present.names).toEqual({ a: 'A2' });
  });

  it('caps the past at the configured limit, dropping the oldest', () => {
    const reduce = withHistory(counter, { ...options, limit: 3 });
    let s = initHistory(start);
    for (let i = 0; i < 5; i++) s = reduce(s, { type: 'inc' });
    expect(s.present.n).toBe(5);
    expect(s.past).toHaveLength(3);
    // Oldest kept step is n:2 (n:0 and n:1 fell off the end).
    expect(s.past[0]).toEqual({ n: 2, names: {} });
  });
});
