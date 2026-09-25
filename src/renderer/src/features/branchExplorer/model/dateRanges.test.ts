import { describe, expect, it } from 'vitest';
import { sinceDateFor } from './dateRanges';

describe('sinceDateFor', () => {
  const now = new Date(2026, 8, 25, 10, 0);

  it('counts days back from today', () => {
    expect(sinceDateFor('week', now)).toBe('2026-09-18');
    expect(sinceDateFor('quarter', now)).toBe('2026-06-26');
  });

  it('has no start for all history', () => {
    expect(sinceDateFor('all', now)).toBeUndefined();
  });
});
