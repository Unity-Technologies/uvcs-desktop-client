import { describe, expect, it } from 'vitest';
import { stepGoal } from './stepNavigation';

describe('stepGoal', () => {
  const atLast = { count: 3, current: 2, above: 0 };
  const lastFile = { canStep: () => false };
  const fileAfter = { canStep: () => true };

  it('goes through the steps, then on to the file beside it, and nowhere past the last of the last file', () => {
    expect(stepGoal({ ...atLast, current: 1 }, 1, lastFile, false)).toBe('step');
    expect(stepGoal(atLast, 1, fileAfter, false)).toBe('file');
    expect(stepGoal(atLast, 1, lastFile, false)).toBeNull();
    expect(stepGoal(atLast, 1, null, false)).toBeNull();
  });

  it("is enabled, its tip neutral, while presses are kept: a step to the list's last file still settling disables nothing", () => {
    expect(stepGoal(atLast, 1, lastFile, true)).toBe('queued');
    expect(stepGoal(atLast, -1, null, true)).toBe('queued');
  });
});
