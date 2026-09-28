import { describe, expect, it } from 'vitest';
import { longerPresets, sinceDateFor, sincePresetOf } from './sincePresets';

describe('sinceDateFor', () => {
  const now = new Date(2026, 8, 25);

  it('has no date for any time', () => {
    expect(sinceDateFor('anyTime', now)).toBeUndefined();
  });

  it('goes back the preset number of days', () => {
    expect(sinceDateFor('lastWeek', now)).toBe('2026-09-18');
    expect(sinceDateFor('lastMonth', now)).toBe('2026-08-26');
    expect(sinceDateFor('last3Months', now)).toBe('2026-06-26');
  });
});

describe('longerPresets', () => {
  it('lists the longer ranges, any time last', () => {
    expect(longerPresets('last6Months')).toEqual(['lastYear', 'anyTime']);
    expect(longerPresets('anyTime')).toEqual([]);
  });
});

describe('sincePresetOf', () => {
  it("reads the Branch Explorer's former ids and today's presets", () => {
    expect(sincePresetOf('quarter')).toBe('last3Months');
    expect(sincePresetOf('all')).toBe('anyTime');
    expect(sincePresetOf('lastYear')).toBe('lastYear');
    expect(sincePresetOf('fortnight')).toBeUndefined();
    expect(sincePresetOf(undefined)).toBeUndefined();
  });
});
