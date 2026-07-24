/**
 * A generic undo/redo wrapper for any pure reducer. `withHistory(reducer)`
 * returns a new reducer over `{ past, present, future }` that delegates every
 * ordinary action to `reducer` (so the wrapped reducer stays the single source
 * of truth) and adds two of its own: `UNDO` and `REDO`.
 *
 * Deliberately small: history is derived state a component reads to enable its
 * undo/redo buttons; only `present` is what the rest of the app — and
 * persistence — cares about.
 */

/** The three-stack shape plus a private coalesce marker. */
export interface HistoryState<S> {
  /** Older states, oldest first. The last entry is the immediate undo target. */
  past: S[];
  present: S;
  /** Undone states, next-to-redo first. */
  future: S[];
  /** Coalesce key of the last recorded step; null when the run can't extend. */
  lastKey: string | null;
}

export interface HistoryOptions<A> {
  /** Actions that wipe history (e.g. loading a different document). */
  isReset?: (action: A) => boolean;
  /**
   * A key grouping consecutive edits into one undo step (e.g. every keystroke
   * of one rename). Return the same key for actions that should merge, or null
   * for actions that always start their own step.
   */
  coalesceKey?: (action: A) => string | null;
  /** Maximum undo depth. Older steps fall off the end. */
  limit?: number;
}

const DEFAULT_LIMIT = 50;

/** A history whose present is `present` and whose stacks are empty. */
export function initHistory<S>(present: S): HistoryState<S> {
  return { past: [], present, future: [], lastKey: null };
}

/** Every action the wrapped reducer accepts, plus the two history controls. */
export type WithHistoryAction<A> = A | { type: 'UNDO' } | { type: 'REDO' };

export function withHistory<S, A extends { type: string }>(
  reducer: (state: S, action: A) => S,
  options: HistoryOptions<A> = {},
): (state: HistoryState<S>, action: WithHistoryAction<A>) => HistoryState<S> {
  const isReset = options.isReset ?? (() => false);
  const coalesceKey = options.coalesceKey ?? (() => null);
  const limit = options.limit ?? DEFAULT_LIMIT;

  return function historyReducer(state, action) {
    if (action.type === 'UNDO') {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1] as S;
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        lastKey: null,
      };
    }

    if (action.type === 'REDO') {
      if (state.future.length === 0) return state;
      const next = state.future[0] as S;
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
        lastKey: null,
      };
    }

    // An ordinary action: run it through the wrapped reducer.
    const inner = action as A;
    const present = reducer(state.present, inner);

    // Reference-equal result means the action changed nothing — don't record a
    // dead undo step (e.g. a rejected invalid date, or a redundant edit).
    if (present === state.present) return state;

    if (isReset(inner)) return initHistory(present);

    const key = coalesceKey(inner);
    // Merge into the current step when this action continues the same run.
    if (key !== null && key === state.lastKey) {
      return { ...state, present, future: [], lastKey: key };
    }

    const past = [...state.past, state.present];
    return {
      past: past.length > limit ? past.slice(past.length - limit) : past,
      present,
      future: [],
      lastKey: key,
    };
  };
}
