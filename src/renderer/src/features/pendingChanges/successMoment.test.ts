import { describe, expect, it } from 'vitest';
import { checkedInMessage, isOutlivedByChanges, SUCCESS_MOMENT_MS, successCardTellsCheckin, successMomentLeft, type SuccessMoment } from './successMoment';

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

describe('successCardTellsCheckin', () => {
  it('leaves a check-in of everything pending to the card, and one that leaves changes behind to a toast', () => {
    expect(successCardTellsCheckin(3, 3)).toBe(true);
    expect(successCardTellsCheckin(2, 3)).toBe(false);
  });
});

describe('checkedInMessage', () => {
  it('reads as the success card does', () => {
    expect(checkedInMessage(6, '/main')).toBe('Checked in cs:6 on /main');
  });
});
