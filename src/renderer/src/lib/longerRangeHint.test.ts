import { describe, expect, it } from 'vitest';
import { longerRangeHint } from './longerRangeHint';

describe('longerRangeHint', () => {
  it('suggests a longer time range, saying the filters look only within it', () => {
    expect(longerRangeHint('lastMonth', true)).toBe('The filters look within the time range. Try a longer one.');
    expect(longerRangeHint('lastWeek', false)).toBe('Try a longer time range.');
  });

  it('suggests nothing past Any time', () => {
    expect(longerRangeHint('anyTime', true)).toBeUndefined();
    expect(longerRangeHint('anyTime', false)).toBeUndefined();
  });
});
