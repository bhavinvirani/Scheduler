import { useEffect } from 'react';
import { usePresets } from '../state/PresetsContext.tsx';
import { usePaint } from '../state/PaintContext.tsx';
import { formatShiftRange } from '../lib/time.ts';
import { presetLabel, presetDotClass } from './presetDisplay.ts';

/**
 * The desktop "quick fill" strip: click a preset to arm it, then single-click
 * grid cells to stamp that shift. Hidden on mobile (which fills via the cell
 * menu) and never printed. Escape — or the Stop button — disarms.
 */
export function PaintBar() {
  const { presets } = usePresets();
  const { armedPresetId, toggle, disarm } = usePaint();
  const armed = presets.find((preset) => preset.id === armedPresetId) ?? null;

  useEffect(() => {
    if (!armed) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') disarm();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [armed, disarm]);

  if (presets.length === 0) return null;

  return (
    <div className="mb-4 hidden flex-wrap items-center gap-2 rounded-sm border border-rule bg-paper px-3 py-2 md:flex print:hidden">
      <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">
        Quick fill
      </span>
      {presets.map((preset) => {
        const isArmed = preset.id === armedPresetId;
        const named = preset.name.trim();
        const range = formatShiftRange(preset.start, preset.duration);
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={isArmed}
            onClick={() => toggle(preset.id)}
            title={
              isArmed
                ? 'Click again to stop painting'
                : `Paint ${presetLabel(preset)} — then click grid cells`
            }
            className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 ${
              isArmed
                ? 'border-ink bg-ink text-paper'
                : 'border-rule bg-paper text-ink hover:bg-ink/5'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${presetDotClass(preset)}`}
              aria-hidden="true"
            />
            {named && <span className="font-medium">{named}</span>}
            <span
              className={`font-mono text-xs tabular-nums ${
                named
                  ? isArmed
                    ? 'text-paper/70'
                    : 'text-ink/55'
                  : 'font-medium'
              }`}
            >
              {range}
            </span>
          </button>
        );
      })}

      {armed && (
        <span
          role="status"
          className="ml-auto flex items-center gap-2 text-sm text-ink/70"
        >
          Painting{' '}
          <strong className="font-semibold">{presetLabel(armed)}</strong> —
          click cells
          <button
            type="button"
            onClick={disarm}
            className="rounded-sm border border-rule px-2 py-0.5 text-xs font-medium hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/60"
          >
            Stop (Esc)
          </button>
        </span>
      )}
    </div>
  );
}
