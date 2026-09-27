import { describe, expect, it } from 'vitest';
import { msUntilNextSecond } from './nextSecond';

describe('msUntilNextSecond', () => {
  it('waits past the end of the current second, so a write lands in a later one', () => {
    for (const now of [1_790_509_594_000, 1_790_509_594_204, 1_790_509_594_999]) {
      const writtenAt = now + msUntilNextSecond(now);
      expect(Math.floor(writtenAt / 1000)).toBe(Math.floor(now / 1000) + 1);
    }
  });

  it('waits at most a second', () => {
    expect(msUntilNextSecond(1_790_509_594_999)).toBeLessThan(100);
    expect(msUntilNextSecond(1_790_509_594_000)).toBeLessThanOrEqual(1010);
  });
});
