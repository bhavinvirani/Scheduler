import { describe, it, expect } from 'vitest';
import {
  minutesToLabel,
  formatShiftRange,
  assignmentLabel,
  startOptions,
  durationOptions,
  shiftCategory,
} from './time.ts';

describe('minutesToLabel', () => {
  it('renders midnight as 12:00 AM, never 0:00 or 24:00', () => {
    expect(minutesToLabel(0)).toBe('12:00 AM');
  });

  it('renders noon as 12:00 PM', () => {
    expect(minutesToLabel(720)).toBe('12:00 PM');
  });

  it('renders a half-hour morning time', () => {
    expect(minutesToLabel(450)).toBe('7:30 AM');
  });

  it('renders a late-evening time', () => {
    expect(minutesToLabel(1380)).toBe('11:00 PM');
  });

  it('wraps times past midnight back into the same day', () => {
    // 1440 is exactly midnight; 1860 is 7:00 the next morning.
    expect(minutesToLabel(1440)).toBe('12:00 AM');
    expect(minutesToLabel(1860)).toBe('7:00 AM');
  });

  it('wraps negative minutes back into the previous evening', () => {
    // The double-mod normalization exists precisely to handle negatives.
    expect(minutesToLabel(-30)).toBe('11:30 PM');
    expect(minutesToLabel(-60)).toBe('11:00 PM');
  });
});

describe('formatShiftRange', () => {
  it('formats an overnight shift from start and duration', () => {
    // 1380 = 11:00 PM, +480 min (8h) = 7:00 AM.
    expect(formatShiftRange(1380, 480)).toBe('11:00 PM – 7:00 AM');
  });

  it('renders a shift ending exactly at midnight as 12:00 AM, not 24:00', () => {
    // 960 = 4:00 PM, +480 min = 1440 = midnight.
    expect(formatShiftRange(960, 480)).toBe('4:00 PM – 12:00 AM');
  });
});

describe('assignmentLabel', () => {
  it('labels a shift as its time range', () => {
    expect(assignmentLabel({ kind: 'shift', start: 1380, duration: 480 })).toBe(
      '11:00 PM – 7:00 AM',
    );
  });

  it('labels each absence kind with a human word', () => {
    expect(assignmentLabel({ kind: 'off' })).toBe('Off');
    expect(assignmentLabel({ kind: 'pto' })).toBe('PTO');
    expect(assignmentLabel({ kind: 'holiday' })).toBe('Holiday');
  });

  it('labels an empty cell as an empty string', () => {
    expect(assignmentLabel({ kind: 'empty' })).toBe('');
  });
});

describe('startOptions', () => {
  it('covers the whole day in 30-minute steps', () => {
    const options = startOptions();
    expect(options).toHaveLength(48);
    expect(options[0]).toEqual({ value: 0, label: '12:00 AM' });
    expect(options[15]).toEqual({ value: 450, label: '7:30 AM' });
    expect(options[47]).toEqual({ value: 1410, label: '11:30 PM' });
  });
});

describe('durationOptions', () => {
  it('renders each duration as a relative offset with the resulting clock time', () => {
    const options = durationOptions(1380); // starting at 11:00 PM
    expect(options[0]).toEqual({ value: 60, label: '+1h (12:00 AM)' });
    expect(options).toContainEqual({ value: 90, label: '+1h 30m (12:30 AM)' });
    expect(options).toContainEqual({ value: 480, label: '+8h (7:00 AM)' });
    expect(options[options.length - 1]).toEqual({
      value: 720,
      label: '+12h (11:00 AM)',
    });
  });

  it('recomputes the clock times when the start changes', () => {
    const options = durationOptions(450); // starting at 7:30 AM
    expect(options).toContainEqual({ value: 480, label: '+8h (3:30 PM)' });
  });
});

describe('shiftCategory', () => {
  it('buckets a morning start as a day shift', () => {
    expect(shiftCategory(450)).toBe('day'); // 7:30 AM
  });

  it('buckets a midday/afternoon start as an evening shift', () => {
    expect(shiftCategory(960)).toBe('evening'); // 4:00 PM
  });

  it('buckets a late-evening start as a night shift', () => {
    expect(shiftCategory(1380)).toBe('night'); // 11:00 PM
  });

  it('buckets an overnight/early-hours start as a night shift', () => {
    expect(shiftCategory(120)).toBe('night'); // 2:00 AM
  });

  it('places the bucket boundaries at 05:00, 12:00, and 20:00', () => {
    expect(shiftCategory(300)).toBe('day'); // 05:00
    expect(shiftCategory(299)).toBe('night'); // 04:59
    expect(shiftCategory(720)).toBe('evening'); // 12:00
    expect(shiftCategory(719)).toBe('day'); // 11:59
    expect(shiftCategory(1200)).toBe('night'); // 20:00
    expect(shiftCategory(1199)).toBe('evening'); // 19:59
  });
});
