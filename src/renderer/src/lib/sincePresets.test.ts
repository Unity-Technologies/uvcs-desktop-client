import { describe, expect, it } from 'vitest';
import { sinceDateFor } from './sincePresets';

describe('sinceDateFor', () => {
  const now = new Date(2026, 8, 25);

  it('has no date for any time', () => {
    expect(sinceDateFor('anyTime', now)).toBeUndefined();
  });

  it('goes back the preset number of days', () => {
    expect(sinceDateFor('lastWeek', now)).toBe('2026-09-18');
    expect(sinceDateFor('lastMonth', now)).toBe('2026-08-26');
  });
});
