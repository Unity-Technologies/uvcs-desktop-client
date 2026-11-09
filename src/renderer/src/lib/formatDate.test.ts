import { describe, expect, it } from 'vitest';
import { formatDay } from './formatDate';

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
