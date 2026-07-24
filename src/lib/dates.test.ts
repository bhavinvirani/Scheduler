import { describe, it, expect } from 'vitest';
import {
  parseISODateLocal,
  formatISODate,
  mondayOf,
  addDays,
  formatDayHeader,
  formatDateRange,
  isValidISODate,
} from './dates.ts';

describe('parseISODateLocal', () => {
  // The whole point of the local parser. `new Date('2026-07-27')` parses as UTC
  // midnight, which in America/Toronto (UTC-4) is 8PM on the 26th. The test suite
  // runs under TZ=America/Toronto specifically so this regression can't sneak back.
  it('keeps the calendar day intact regardless of timezone', () => {
    const d = parseISODateLocal('2026-07-27');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6); // July is month index 6
    expect(d.getDate()).toBe(27);
  });

  it('anchors at noon so DST transitions cannot cross a day boundary', () => {
    // 2026-03-08 is the spring-forward date in Toronto (2AM -> 3AM).
    const d = parseISODateLocal('2026-03-08');
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(12);
  });
});

describe('formatISODate', () => {
  it('round-trips a parsed date back to its ISO string', () => {
    expect(formatISODate(parseISODateLocal('2026-07-27'))).toBe('2026-07-27');
  });

  it('zero-pads month and day', () => {
    expect(formatISODate(parseISODateLocal('2026-01-05'))).toBe('2026-01-05');
  });
});

describe('mondayOf', () => {
  it('returns the Monday of the week containing a mid-week date', () => {
    // 2026-07-29 is a Wednesday.
    expect(mondayOf('2026-07-29')).toBe('2026-07-27');
  });

  it('returns the same date when given a Monday', () => {
    expect(mondayOf('2026-07-27')).toBe('2026-07-27');
  });

  it('treats Sunday as the end of the week, not the start', () => {
    // 2026-08-02 is a Sunday; its Monday is six days earlier.
    expect(mondayOf('2026-08-02')).toBe('2026-07-27');
  });

  it('resolves every weekday in the anchor week back to its Monday', () => {
    // The single modulo formula must hold for all seven offsets, not just the
    // three spot-checked above — Tue/Thu/Fri/Sat were previously untested.
    expect(mondayOf('2026-07-28')).toBe('2026-07-27'); // Tue (offset 1)
    expect(mondayOf('2026-07-30')).toBe('2026-07-27'); // Thu (offset 3)
    expect(mondayOf('2026-07-31')).toBe('2026-07-27'); // Fri (offset 4)
    expect(mondayOf('2026-08-01')).toBe('2026-07-27'); // Sat (offset 5)
  });
});

describe('isValidISODate', () => {
  it('accepts a well-formed calendar date', () => {
    expect(isValidISODate('2026-07-27')).toBe(true);
    expect(isValidISODate('2026-02-28')).toBe(true);
  });

  it('rejects an empty string (a cleared date input)', () => {
    expect(isValidISODate('')).toBe(false);
  });

  it('rejects strings with the wrong shape', () => {
    expect(isValidISODate('2026-07')).toBe(false);
    expect(isValidISODate('July 27')).toBe(false);
    expect(isValidISODate('2026/07/27')).toBe(false);
  });

  it('rejects impossible dates that match the shape', () => {
    expect(isValidISODate('2026-13-40')).toBe(false); // month 13
    expect(isValidISODate('2026-02-30')).toBe(false); // no Feb 30
  });
});

describe('addDays', () => {
  it('advances by whole days, crossing a month boundary', () => {
    expect(addDays('2026-07-27', 7)).toBe('2026-08-03');
  });

  it('goes backwards with a negative offset', () => {
    expect(addDays('2026-08-03', -7)).toBe('2026-07-27');
  });

  it('spans the full fortnight (day 0 to day 13)', () => {
    expect(addDays('2026-07-27', 13)).toBe('2026-08-09');
  });
});

describe('formatDayHeader', () => {
  it('splits a date into a short weekday and a short month/day label', () => {
    expect(formatDayHeader('2026-07-27')).toEqual({
      weekday: 'Mon',
      date: 'Jul 27',
    });
  });
});

describe('formatDateRange', () => {
  it('renders a fortnight as a compact range with a single trailing year', () => {
    expect(formatDateRange('2026-07-27', '2026-08-09')).toBe(
      'Jul 27 – Aug 9, 2026',
    );
  });

  it('renders a single week', () => {
    expect(formatDateRange('2026-07-27', '2026-08-02')).toBe(
      'Jul 27 – Aug 2, 2026',
    );
  });
});
