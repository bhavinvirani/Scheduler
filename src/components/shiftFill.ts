import type { Assignment } from '../types.ts';
import type { DisplayMode } from '../state/DisplayModeContext.tsx';
import { shiftCategory } from '../lib/time.ts';

const SHIFT_FILL: Record<ReturnType<typeof shiftCategory>, string> = {
  day: 'bg-day text-white',
  evening: 'bg-evening text-white',
  night: 'bg-night text-white',
};

/**
 * Background + text color for a shift/absence surface (grid cell or mobile row).
 * Black-and-white mode keeps everything white with black text so it prints
 * cleanly and the time stays legible; color mode fills shifts by time of day.
 */
export function fillClass(assignment: Assignment, mode: DisplayMode): string {
  if (mode === 'mono') {
    if (assignment.kind === 'shift') return 'bg-white text-ink';
    if (assignment.kind === 'empty') return 'bg-white text-ink/40';
    return 'bg-white text-ink/60'; // off / pto / holiday — recessed
  }
  if (assignment.kind === 'shift')
    return SHIFT_FILL[shiftCategory(assignment.start)];
  if (assignment.kind === 'empty') return 'bg-paper text-ink/40';
  return 'bg-absent text-ink'; // off / pto / holiday
}
