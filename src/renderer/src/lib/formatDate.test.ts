import { describe, expect, it } from 'vitest';
import { formatDay, formatShortAge, formatShortDay } from './formatDate';

describe('formatDay', () => {
  it('names the day in words, in the locale and time zone given', () => {
    expect(formatDay('2026-10-30T23:30:00Z', { locale: 'en-US', timeZone: 'UTC' })).toBe('October 30, 2026');
    expect(formatDay('2026-10-30T23:30:00Z', { locale: 'en-US', timeZone: 'Asia/Tokyo' })).toBe('October 31, 2026');
    expect(formatDay('2026-10-30T12:00:00Z', { locale: 'es-ES', timeZone: 'UTC' })).toBe('30 de octubre de 2026');
  });

  it('is none for a date it cannot read', () => {
    expect(formatDay('not a date')).toBeNull();
    expect(formatDay('')).toBeNull();
  });
});

describe('formatShortAge', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  const at = { locale: 'en-US', timeZone: 'UTC' };

  it('says now under a minute, minutes under an hour, hours under a day', () => {
    expect(formatShortAge('2026-11-12T11:59:30Z', now, at)).toBe('now');
    expect(formatShortAge('2026-11-12T11:48:00Z', now, at)).toBe('12m');
    expect(formatShortAge('2026-11-12T09:00:00Z', now, at)).toBe('3h');
  });

  it('says days under a week', () => {
    expect(formatShortAge('2026-11-10T12:00:00Z', now, at)).toBe('2d');
    expect(formatShortAge('2026-11-05T12:00:01Z', now, at)).toBe('6d');
  });

  it('names the day from a week on, and the month and year before this year', () => {
    expect(formatShortAge('2026-10-14T08:00:00Z', now, at)).toBe('Oct 14');
    expect(formatShortAge('2025-10-14T08:00:00Z', now, at)).toBe('Oct 2025');
  });

  it('reads the day in the time zone given', () => {
    expect(formatShortAge('2026-10-14T23:30:00Z', now, { locale: 'en-US', timeZone: 'Asia/Tokyo' })).toBe('Oct 15');
  });

  it('says now for a moment ahead of the clock (a server whose clock runs ahead)', () => {
    expect(formatShortAge('2026-11-12T12:05:00Z', now, at)).toBe('now');
  });

  it('is empty for a date it cannot read', () => {
    expect(formatShortAge('not a date', now, at)).toBe('');
  });
});

describe('formatShortDay', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');

  it('names the day, with its year when it is not this year', () => {
    expect(formatShortDay('2026-11-09T10:00:00Z', now, { locale: 'en-US', timeZone: 'UTC' })).toBe('Nov 9');
    expect(formatShortDay('2025-11-09T10:00:00Z', now, { locale: 'en-US', timeZone: 'UTC' })).toBe('Nov 9, 2025');
    expect(formatShortDay('2026-11-09T10:00:00Z', now, { locale: 'en-GB', timeZone: 'UTC' })).toBe('9 Nov');
  });

  it('is empty for a date it cannot read', () => {
    expect(formatShortDay('', now, {})).toBe('');
  });
});
