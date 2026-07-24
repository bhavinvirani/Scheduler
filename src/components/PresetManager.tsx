import type { Dispatch } from 'react';
import type { ShiftPreset } from '../types.ts';
import type { PresetsAction } from '../state/presetsReducer.ts';
import { usePresets } from '../state/PresetsContext.tsx';
import {
  durationOptions,
  formatShiftRange,
  startOptions,
} from '../lib/time.ts';
import { presetDotClass } from './presetDisplay.ts';
import { Modal } from './Modal.tsx';

// Static across every row — build the 48 start options once.
const START_OPTIONS = startOptions();

const primaryBtn =
  'rounded-sm bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink/85 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-ink/60';
const secondaryBtn =
  'rounded-sm border border-rule bg-paper px-3 py-1.5 text-sm font-medium text-ink ' +
  'hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60';
const rowSelect =
  'rounded-sm border border-rule bg-paper px-1.5 py-1 font-mono text-sm text-ink ' +
  'outline-none focus-visible:ring-2 focus-visible:ring-ink/50';

interface PresetManagerProps {
  open: boolean;
  onClose: () => void;
}

/** The add / rename / retime / delete editor for the shift-preset library. */
export function PresetManager({ open, onClose }: PresetManagerProps) {
  const { presets, dispatch } = usePresets();

  return (
    <Modal
      open={open}
      onClose={onClose}
      labelledBy="preset-manager-title"
      describedBy="preset-manager-desc"
      className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-sm border border-rule bg-paper p-5"
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <h2 id="preset-manager-title" className="text-base font-semibold">
          Shift presets
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
      <p id="preset-manager-desc" className="mb-4 text-sm text-ink/60">
        Reusable shift templates. Edits apply everywhere you use them.
      </p>

      {presets.length === 0 ? (
        <p className="rounded-sm border border-dashed border-rule px-4 py-8 text-center text-sm text-ink/60">
          No presets yet. Add one to start one-tap filling.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">
          {presets.map((preset) => (
            <PresetRow key={preset.id} preset={preset} dispatch={dispatch} />
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
        <button
          type="button"
          onClick={() => dispatch({ type: 'ADD_PRESET' })}
          className={secondaryBtn}
        >
          + Add preset
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'RESET_PRESETS' })}
          className={secondaryBtn}
        >
          Restore defaults
        </button>
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

function PresetRow({
  preset,
  dispatch,
}: {
  preset: ShiftPreset;
  dispatch: Dispatch<PresetsAction>;
}) {
  const update = (patch: Partial<Omit<ShiftPreset, 'id'>>) =>
    dispatch({ type: 'UPDATE_PRESET', id: preset.id, patch });

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-sm border border-rule px-2 py-2">
      <span
        className={`h-3 w-3 shrink-0 rounded-full ${presetDotClass(preset)}`}
        aria-hidden="true"
      />
      <input
        type="text"
        value={preset.name}
        placeholder="Name"
        aria-label="Preset name"
        onChange={(event) => update({ name: event.target.value })}
        className="min-w-[6rem] flex-1 bg-transparent px-1 py-1 text-sm font-medium outline-none placeholder:text-ink/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/50"
      />
      <span className="hidden shrink-0 font-mono text-xs text-ink/50 sm:inline">
        {formatShiftRange(preset.start, preset.duration)}
      </span>
      <select
        aria-label="Preset start time"
        value={preset.start}
        onChange={(event) => update({ start: Number(event.target.value) })}
        className={rowSelect}
      >
        {START_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        aria-label="Preset length"
        value={preset.duration}
        onChange={(event) => update({ duration: Number(event.target.value) })}
        className={rowSelect}
      >
        {durationOptions(preset.start).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={`Delete ${preset.name || 'preset'}`}
        title="Delete preset"
        onClick={() => dispatch({ type: 'REMOVE_PRESET', id: preset.id })}
        className="shrink-0 rounded px-2 py-1 text-lg leading-none text-ink/40 hover:bg-ink/5 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/50"
      >
        ×
      </button>
    </li>
  );
}
