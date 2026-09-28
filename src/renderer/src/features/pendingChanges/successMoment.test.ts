import { describe, expect, it } from 'vitest';
import { checkedInMessage, isMomentOver, successCardTellsCheckin, type SuccessMoment } from './successMoment';

const moment: SuccessMoment = { verb: 'Checked in', changesetId: 4, at: 1_000 };
const noChanges = { readAt: 2_000, count: 0 };

describe('isMomentOver', () => {
  it('lasts while Changes stays empty on the changeset it tells, however long', () => {
    expect(isMomentOver(moment, { readAt: 100_000, count: 0 }, { readAt: 100_000, loadedChangeset: 4 })).toBe(false);
  });

  it('ends once pending changes are read after it', () => {
    expect(isMomentOver(moment, { readAt: 2_000, count: 1 }, undefined)).toBe(true);
  });

  it('outlasts the changes read before it, still on screen until the refresh', () => {
    expect(isMomentOver(moment, { readAt: 900, count: 3 }, undefined)).toBe(false);
  });

  it('ends once the workspace is read on another changeset after it: a switch, an update', () => {
    expect(isMomentOver(moment, noChanges, { readAt: 2_000, loadedChangeset: 7 })).toBe(true);
  });

  it('outlasts the workspace read before it, still on the changeset it was before the check-in', () => {
    expect(isMomentOver(moment, noChanges, { readAt: 900, loadedChangeset: 3 })).toBe(false);
  });
});

describe('successCardTellsCheckin', () => {
  it('leaves a check-in of everything pending to the success moment, and one that leaves changes behind to a toast', () => {
    expect(successCardTellsCheckin(3, 3)).toBe(true);
    expect(successCardTellsCheckin(2, 3)).toBe(false);
  });
});

describe('checkedInMessage', () => {
  it('names the changeset and the branch', () => {
    expect(checkedInMessage(6, '/main')).toBe('Checked in cs:6 on /main');
  });
});
