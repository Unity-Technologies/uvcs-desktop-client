import { describe, expect, it } from 'vitest';
import { isOutlivedByChanges, SUCCESS_MOMENT_MS, successMomentLeft, type SuccessMoment } from './successMoment';

const moment: SuccessMoment = { verb: 'Checked in', changesetId: 4, branch: '/main/task001', at: 1_000 };

describe('successMomentLeft', () => {
  it('counts down from the moment it happened', () => {
    expect(successMomentLeft(moment, 1_000)).toBe(SUCCESS_MOMENT_MS);
    expect(successMomentLeft(moment, 4_000)).toBe(SUCCESS_MOMENT_MS - 3_000);
    expect(successMomentLeft(moment, 1_000 + SUCCESS_MOMENT_MS + 1)).toBe(0);
  });
});

describe('isOutlivedByChanges', () => {
  it('ends once pending changes are read after it', () => {
    expect(isOutlivedByChanges(moment, 2_000, 1)).toBe(true);
  });

  it('outlasts the changes read before it, still on screen until the refresh', () => {
    expect(isOutlivedByChanges(moment, 900, 3)).toBe(false);
    expect(isOutlivedByChanges(moment, 2_000, 0)).toBe(false);
  });
});
