import { describe, it, expect } from 'vitest';
import type { Schedule, Assignment } from '../types.ts';
import {
  scheduleReducer,
  createEmptySchedule,
  cellKey,
  getAssignment,
} from './scheduleReducer.ts';

const MONDAY = '2026-07-27';
const SHIFT: Assignment = { kind: 'shift', start: 1380, duration: 480 };

/** Add a person and hand back both the new state and the generated id. */
function addPerson(state: Schedule): { state: Schedule; id: string } {
  const next = scheduleReducer(state, { type: 'ADD_PERSON' });
  const person = next.people.at(-1);
  if (!person) throw new Error('expected a person to have been added');
  return { state: next, id: person.id };
}

describe('createEmptySchedule', () => {
  it('starts empty at version 1 with a two-week span', () => {
    const schedule = createEmptySchedule(MONDAY);
    expect(schedule.version).toBe(1);
    expect(schedule.weekCount).toBe(2);
    expect(schedule.people).toEqual([]);
    expect(schedule.assignments).toEqual({});
  });

  it('snaps the start date to the Monday of its week', () => {
    // 2026-07-29 is a Wednesday.
    expect(createEmptySchedule('2026-07-29').startDate).toBe(MONDAY);
  });

  it('falls back to a valid date when handed a malformed one', () => {
    // Must never write "NaN-NaN-NaN" into the schedule.
    const schedule = createEmptySchedule('');
    expect(schedule.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('ADD_PERSON', () => {
  it('appends a person with a unique id and a blank name', () => {
    const first = addPerson(createEmptySchedule(MONDAY));
    const second = addPerson(first.state);

    expect(second.state.people).toHaveLength(2);
    expect(first.id).not.toBe(second.id);
    expect(second.state.people[1]?.name).toBe('');
  });

  it('does not mutate the previous state', () => {
    const base = createEmptySchedule(MONDAY);
    addPerson(base);
    expect(base.people).toHaveLength(0);
  });

  it('leaves existing assignments untouched when another person is added', () => {
    // Plan §9: ADD_PERSON then SET_ASSIGNMENT — existing assignments untouched.
    const a = addPerson(createEmptySchedule(MONDAY));
    const withShift = scheduleReducer(a.state, {
      type: 'SET_ASSIGNMENT',
      personId: a.id,
      dayIndex: 0,
      value: SHIFT,
    });

    const b = addPerson(withShift);
    const final = scheduleReducer(b.state, {
      type: 'SET_ASSIGNMENT',
      personId: b.id,
      dayIndex: 0,
      value: { kind: 'off' },
    });

    expect(getAssignment(final, a.id, 0)).toEqual(SHIFT);
  });
});

describe('SET_ASSIGNMENT', () => {
  it('stores an assignment retrievable by getAssignment', () => {
    const { state, id } = addPerson(createEmptySchedule(MONDAY));
    const next = scheduleReducer(state, {
      type: 'SET_ASSIGNMENT',
      personId: id,
      dayIndex: 3,
      value: SHIFT,
    });
    expect(getAssignment(next, id, 3)).toEqual(SHIFT);
  });

  it('defaults an unset cell to empty', () => {
    const { state, id } = addPerson(createEmptySchedule(MONDAY));
    expect(getAssignment(state, id, 5)).toEqual({ kind: 'empty' });
  });

  it('returns a stable reference for empty cells so memoized cells can skip', () => {
    const { state, id } = addPerson(createEmptySchedule(MONDAY));
    expect(getAssignment(state, id, 5)).toBe(getAssignment(state, id, 9));
  });

  it('prunes the key when a cell is set back to empty', () => {
    const { state, id } = addPerson(createEmptySchedule(MONDAY));
    const filled = scheduleReducer(state, {
      type: 'SET_ASSIGNMENT',
      personId: id,
      dayIndex: 0,
      value: SHIFT,
    });
    const cleared = scheduleReducer(filled, {
      type: 'SET_ASSIGNMENT',
      personId: id,
      dayIndex: 0,
      value: { kind: 'empty' },
    });
    expect(cleared.assignments).not.toHaveProperty(cellKey(id, 0));
    expect(getAssignment(cleared, id, 0)).toEqual({ kind: 'empty' });
  });

  it('does not mutate the previous assignments map', () => {
    const { state, id } = addPerson(createEmptySchedule(MONDAY));
    const originalAssignments = state.assignments;
    const next = scheduleReducer(state, {
      type: 'SET_ASSIGNMENT',
      personId: id,
      dayIndex: 0,
      value: SHIFT,
    });
    expect(next.assignments).not.toBe(originalAssignments);
    expect(originalAssignments).toEqual({});
  });
});

describe('REMOVE_PERSON', () => {
  it('prunes exactly that person’s keys and no others', () => {
    // Plan §9.
    const a = addPerson(createEmptySchedule(MONDAY));
    const b = addPerson(a.state);

    let state = a.state;
    state = b.state;
    state = scheduleReducer(state, {
      type: 'SET_ASSIGNMENT',
      personId: a.id,
      dayIndex: 0,
      value: SHIFT,
    });
    state = scheduleReducer(state, {
      type: 'SET_ASSIGNMENT',
      personId: a.id,
      dayIndex: 10,
      value: { kind: 'pto' },
    });
    state = scheduleReducer(state, {
      type: 'SET_ASSIGNMENT',
      personId: b.id,
      dayIndex: 0,
      value: { kind: 'off' },
    });

    const after = scheduleReducer(state, {
      type: 'REMOVE_PERSON',
      id: a.id,
    });

    expect(after.people.map((p) => p.id)).toEqual([b.id]);
    expect(after.assignments).not.toHaveProperty(cellKey(a.id, 0));
    expect(after.assignments).not.toHaveProperty(cellKey(a.id, 10));
    expect(after.assignments).toHaveProperty(cellKey(b.id, 0));
    expect(getAssignment(after, b.id, 0)).toEqual({ kind: 'off' });
  });

  it('does not delete a different person whose id is a prefix match', () => {
    // The trailing colon in the `${id}:` prefix is the only thing keeping
    // person 'abc' from also pruning 'abcd:0'. LOAD lets us pick colliding ids.
    const loaded = scheduleReducer(createEmptySchedule(MONDAY), {
      type: 'LOAD',
      schedule: {
        version: 1,
        startDate: MONDAY,
        weekCount: 2,
        people: [
          { id: 'abc', name: 'Ada' },
          { id: 'abcd', name: 'Ben' },
        ],
        assignments: {
          'abc:0': { kind: 'off' },
          'abcd:0': SHIFT,
        },
      },
    });

    const after = scheduleReducer(loaded, { type: 'REMOVE_PERSON', id: 'abc' });

    expect(after.people.map((p) => p.id)).toEqual(['abcd']);
    expect(after.assignments).not.toHaveProperty('abc:0');
    expect(getAssignment(after, 'abcd', 0)).toEqual(SHIFT);
  });

  it('does not mutate the previous state', () => {
    const { state, id } = addPerson(createEmptySchedule(MONDAY));
    const withShift = scheduleReducer(state, {
      type: 'SET_ASSIGNMENT',
      personId: id,
      dayIndex: 0,
      value: SHIFT,
    });
    const beforeAssignments = withShift.assignments;
    const beforePeople = withShift.people;

    const after = scheduleReducer(withShift, {
      type: 'REMOVE_PERSON',
      id,
    });

    expect(after.assignments).not.toBe(beforeAssignments);
    expect(after.people).not.toBe(beforePeople);
    expect(beforeAssignments).toHaveProperty(cellKey(id, 0)); // original intact
    expect(beforePeople.map((p) => p.id)).toEqual([id]);
  });
});

describe('RENAME_PERSON', () => {
  it('changes the name without disturbing assignment keys', () => {
    // Plan §9: this is the test that proves IDs, not indices, are the identity.
    const { state, id } = addPerson(createEmptySchedule(MONDAY));
    const withShift = scheduleReducer(state, {
      type: 'SET_ASSIGNMENT',
      personId: id,
      dayIndex: 4,
      value: SHIFT,
    });

    const renamed = scheduleReducer(withShift, {
      type: 'RENAME_PERSON',
      id,
      name: 'Dr. Okafor',
    });

    expect(renamed.people[0]?.name).toBe('Dr. Okafor');
    expect(renamed.people[0]?.id).toBe(id);
    expect(getAssignment(renamed, id, 4)).toEqual(SHIFT);
  });
});

describe('COPY_WEEK_1_TO_2', () => {
  it('maps day indices 0–6 onto 7–13, overwriting week 2 completely', () => {
    // Plan §9.
    const { state, id } = addPerson(createEmptySchedule(MONDAY));

    let s = scheduleReducer(state, {
      type: 'SET_ASSIGNMENT',
      personId: id,
      dayIndex: 0,
      value: SHIFT,
    });
    s = scheduleReducer(s, {
      type: 'SET_ASSIGNMENT',
      personId: id,
      dayIndex: 2,
      value: { kind: 'off' },
    });
    // A stale week-2 value that must be overwritten (day 3 in week 1 is empty,
    // so its week-2 counterpart, day 10, must be cleared by the copy).
    s = scheduleReducer(s, {
      type: 'SET_ASSIGNMENT',
      personId: id,
      dayIndex: 10,
      value: { kind: 'pto' },
    });

    const copied = scheduleReducer(s, { type: 'COPY_WEEK_1_TO_2' });

    expect(getAssignment(copied, id, 7)).toEqual(SHIFT); // from day 0
    expect(getAssignment(copied, id, 9)).toEqual({ kind: 'off' }); // from day 2
    expect(getAssignment(copied, id, 10)).toEqual({ kind: 'empty' }); // cleared
    // Week 1 is left exactly as it was.
    expect(getAssignment(copied, id, 0)).toEqual(SHIFT);
    expect(getAssignment(copied, id, 2)).toEqual({ kind: 'off' });
  });

  it('does not mutate the previous assignments map', () => {
    // This action does the most in-place work (assign + delete on a copy), so
    // its immutability is worth pinning: undo/redo depends on it.
    const { state, id } = addPerson(createEmptySchedule(MONDAY));
    const seeded = scheduleReducer(state, {
      type: 'SET_ASSIGNMENT',
      personId: id,
      dayIndex: 10, // week-2 cell that the copy will clear
      value: { kind: 'pto' },
    });
    const beforeAssignments = seeded.assignments;

    const copied = scheduleReducer(seeded, { type: 'COPY_WEEK_1_TO_2' });

    expect(copied.assignments).not.toBe(beforeAssignments);
    expect(beforeAssignments[cellKey(id, 10)]).toEqual({ kind: 'pto' });
  });
});

describe('SET_WEEK_COUNT', () => {
  it('preserves week-2 assignments across a 2 → 1 → 2 toggle', () => {
    // Plan §9: toggling the week count is non-destructive.
    const { state, id } = addPerson(createEmptySchedule(MONDAY));
    const withWeek2 = scheduleReducer(state, {
      type: 'SET_ASSIGNMENT',
      personId: id,
      dayIndex: 10,
      value: SHIFT,
    });

    const toOne = scheduleReducer(withWeek2, {
      type: 'SET_WEEK_COUNT',
      count: 1,
    });
    expect(toOne.weekCount).toBe(1);

    const backToTwo = scheduleReducer(toOne, {
      type: 'SET_WEEK_COUNT',
      count: 2,
    });
    expect(backToTwo.weekCount).toBe(2);
    expect(getAssignment(backToTwo, id, 10)).toEqual(SHIFT);
  });
});

describe('SET_START_DATE', () => {
  it('snaps the chosen date to the Monday of its week', () => {
    const state = createEmptySchedule(MONDAY);
    const moved = scheduleReducer(state, {
      type: 'SET_START_DATE',
      iso: '2026-08-05', // a Wednesday
    });
    expect(moved.startDate).toBe('2026-08-03');
  });

  it('ignores a malformed date instead of corrupting the start date', () => {
    // A cleared HTML date input dispatches iso: '' — the state must not change.
    const state = createEmptySchedule(MONDAY);
    expect(scheduleReducer(state, { type: 'SET_START_DATE', iso: '' })).toBe(
      state,
    );
    expect(
      scheduleReducer(state, { type: 'SET_START_DATE', iso: '2026-13-40' })
        .startDate,
    ).toBe(MONDAY);
  });
});

describe('SET_TITLE', () => {
  it('sets a custom schedule title', () => {
    const state = createEmptySchedule(MONDAY);
    const next = scheduleReducer(state, {
      type: 'SET_TITLE',
      title: 'Night Rotation',
    });
    expect(next.title).toBe('Night Rotation');
  });

  it('does not mutate the previous state', () => {
    const state = createEmptySchedule(MONDAY);
    scheduleReducer(state, { type: 'SET_TITLE', title: 'X' });
    expect(state.title).toBeUndefined();
  });
});

describe('CLEAR_ALL', () => {
  it('empties the grid but keeps the roster, dates, and week count', () => {
    const { state, id } = addPerson(createEmptySchedule(MONDAY));
    const filled = scheduleReducer(state, {
      type: 'SET_ASSIGNMENT',
      personId: id,
      dayIndex: 0,
      value: SHIFT,
    });

    const cleared = scheduleReducer(filled, { type: 'CLEAR_ALL' });

    expect(cleared.assignments).toEqual({});
    expect(cleared.people.map((p) => p.id)).toEqual([id]);
    expect(cleared.startDate).toBe(MONDAY);
    expect(cleared.weekCount).toBe(2);
  });
});

describe('LOAD', () => {
  it('replaces the entire state with the loaded schedule', () => {
    const current = createEmptySchedule(MONDAY);
    const incoming: Schedule = {
      version: 1,
      startDate: '2026-01-05',
      weekCount: 1,
      people: [{ id: 'abc', name: 'Loaded' }],
      assignments: { 'abc:0': SHIFT },
    };

    const loaded = scheduleReducer(current, {
      type: 'LOAD',
      schedule: incoming,
    });
    expect(loaded).toEqual(incoming);
  });
});
