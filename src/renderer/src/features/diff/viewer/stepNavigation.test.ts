import { describe, expect, it } from 'vitest';
import { stepAt } from './stepNavigation';

describe('stepAt', () => {
  it('moves to a step the view has, picked by its number (a mark of the change map)', () => {
    expect(stepAt(0, 12)).toBe(0);
    expect(stepAt(11, 12)).toBe(11);
  });

  it("moves nowhere for a step the view no longer has: picked as the steps changed under it", () => {
    expect(stepAt(12, 12)).toBeNull();
    expect(stepAt(-1, 12)).toBeNull();
    expect(stepAt(0, 0)).toBeNull();
  });
});
