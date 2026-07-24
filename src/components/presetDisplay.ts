import type { ShiftPreset } from '../types.ts';
import type { ShiftCategory } from '../lib/time.ts';
import { formatShiftRange, shiftCategory } from '../lib/time.ts';

// Full class strings (not interpolated) so Tailwind's scanner emits them.
const DOT_CLASS: Record<ShiftCategory, string> = {
  day: 'bg-day',
  evening: 'bg-evening',
  night: 'bg-night',
};

/** A preset's label — its name, or the clock range when it has no name yet. */
export function presetLabel(preset: ShiftPreset): string {
  return preset.name.trim() || formatShiftRange(preset.start, preset.duration);
}

/** Static Tailwind background class for a preset's time-of-day swatch. */
export function presetDotClass(preset: ShiftPreset): string {
  return DOT_CLASS[shiftCategory(preset.start)];
}

/** A fuller label for a dropdown option: `Day · 7:00 AM – 3:00 PM`. */
export function presetMenuLabel(preset: ShiftPreset): string {
  const range = formatShiftRange(preset.start, preset.duration);
  const name = preset.name.trim();
  return name ? `${name} · ${range}` : range;
}
