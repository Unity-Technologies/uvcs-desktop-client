import { describe, expect, it } from 'vitest';
import { holdsNewValues } from './useNewValuesEffect';

describe('holdsNewValues', () => {
  it('runs the first time', () => {
    expect(holdsNewValues(undefined, ['row-1'])).toBe(true);
  });

  it("doesn't run again for the values it ran for: a view kept mounted shown again", () => {
    const pick = { threadId: 51 };
    expect(holdsNewValues(['row-1', 3], ['row-1', 3])).toBe(false);
    expect(holdsNewValues([true, pick], [true, pick])).toBe(false);
  });

  it('runs for any value that changed, by identity', () => {
    expect(holdsNewValues(['row-1', 3], ['row-2', 3])).toBe(true);
    expect(holdsNewValues([true, { threadId: 51 }], [true, { threadId: 51 }])).toBe(true);
    expect(holdsNewValues([null], [undefined])).toBe(true);
  });

  it('tells NaN apart as React does, by Object.is', () => {
    expect(holdsNewValues([Number.NaN], [Number.NaN])).toBe(false);
  });
});
