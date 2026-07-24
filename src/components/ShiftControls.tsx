import type { Dispatch } from 'react';
import type { Assignment, ShiftPreset } from '../types.ts';
import type { Action } from '../state/scheduleReducer.ts';
import { DEFAULT_SHIFT_DURATION_MINUTES } from '../constants.ts';
import { durationOptions, startOptions } from '../lib/time.ts';
import { presetMenuLabel } from './presetDisplay.ts';

// Static across every cell — build the 48 start options once, not per render.
const START_OPTIONS = startOptions();

const STATUS_OPTIONS = [
  { value: 'empty', label: '—' },
  { value: 'off', label: 'Off' },
  { value: 'pto', label: 'PTO' },
  { value: 'holiday', label: 'Holiday' },
] as const;

interface ShiftControlsProps {
  personId: string;
  dayIndex: number;
  assignment: Assignment;
  dispatch: Dispatch<Action>;
  /** The preset library, offered as one-tap fills atop the menu. */
  presets: ShiftPreset[];
  /** Human context for screen readers, e.g. "Ada — Monday Jul 20". */
  cellLabel: string;
  /** 'compact' for the dense grid, 'comfortable' for tappable mobile rows. */
  size?: 'compact' | 'comfortable';
  /** Blocks editing until the person has a name (can't schedule a blank row). */
  disabled?: boolean;
}

/**
 * The start-time / status + duration selects for one assignment. Shared by the
 * desktop grid cell and the mobile card row so both edit identically. The
 * background/text color comes from the wrapping element (selects inherit it).
 */
export function ShiftControls({
  personId,
  dayIndex,
  assignment,
  dispatch,
  presets,
  cellLabel,
  size = 'compact',
  disabled = false,
}: ShiftControlsProps) {
  const setValue = (value: Assignment) =>
    dispatch({ type: 'SET_ASSIGNMENT', personId, dayIndex, value });

  const handleStatusOrStart = (raw: string) => {
    if (raw.startsWith('p:')) {
      // A preset fills start + duration in one go. Ignore a stale id gracefully.
      const preset = presets.find((candidate) => candidate.id === raw.slice(2));
      if (preset) {
        setValue({
          kind: 'shift',
          start: preset.start,
          duration: preset.duration,
        });
      }
    } else if (raw.startsWith('t:')) {
      const start = Number(raw.slice(2));
      // Keep the current length when only the start moves; otherwise default to 8h.
      const duration =
        assignment.kind === 'shift'
          ? assignment.duration
          : DEFAULT_SHIFT_DURATION_MINUTES;
      setValue({ kind: 'shift', start, duration });
    } else if (raw === 'off' || raw === 'pto' || raw === 'holiday') {
      setValue({ kind: raw });
    } else {
      setValue({ kind: 'empty' });
    }
  };

  const primaryValue =
    assignment.kind === 'shift' ? `t:${assignment.start}` : assignment.kind;

  const sizing = size === 'comfortable' ? 'py-2 text-sm' : 'py-1 text-xs';
  const selectClass =
    `w-full cursor-pointer appearance-none bg-transparent px-1.5 font-mono ${sizing} ` +
    'font-medium tabular-nums leading-tight outline-none ' +
    'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/50 ' +
    'disabled:cursor-not-allowed disabled:opacity-40';
  const disabledHint = disabled
    ? 'Add a name to schedule this person'
    : undefined;

  return (
    <div className="flex flex-col">
      <select
        aria-label={`${cellLabel} — start time or status`}
        value={primaryValue}
        onChange={(event) => handleStatusOrStart(event.target.value)}
        disabled={disabled}
        title={disabledHint}
        className={selectClass}
      >
        {presets.length > 0 && (
          <optgroup label="Presets">
            {presets.map((preset) => (
              <option key={preset.id} value={`p:${preset.id}`}>
                {presetMenuLabel(preset)}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Start time">
          {START_OPTIONS.map((option) => (
            <option key={option.value} value={`t:${option.value}`}>
              {option.label}
            </option>
          ))}
        </optgroup>
        <optgroup label="Status">
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </optgroup>
      </select>

      {assignment.kind === 'shift' && (
        <select
          aria-label={`${cellLabel} — shift length`}
          value={assignment.duration}
          onChange={(event) =>
            setValue({
              kind: 'shift',
              start: assignment.start,
              duration: Number(event.target.value),
            })
          }
          disabled={disabled}
          title={disabledHint}
          className={`${selectClass} border-t border-black/10`}
        >
          {durationOptions(assignment.start).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
