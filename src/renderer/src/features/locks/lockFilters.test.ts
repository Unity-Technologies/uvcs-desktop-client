import { describe, expect, it } from 'vitest';
import type { Lock } from '@shared/domain/lock';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { lockFilterTexts, readsOnlyMyLocks } from './lockFilters';

describe('whose locks Locks reads', () => {
  it("reads only the user's for Mine alone", () => {
    expect(readsOnlyMyLocks(MINE)).toBe(true);
  });

  it("reads everyone's for everyone, and for other people picked, with the user or not", () => {
    expect(readsOnlyMyLocks(EVERYONE)).toBe(false);
    expect(readsOnlyMyLocks({ mine: false, others: ['ana'] })).toBe(false);
    expect(readsOnlyMyLocks({ mine: true, others: ['ana'] })).toBe(false);
  });
});

describe('the locks filter', () => {
  const lock: Lock = {
    itemId: 7,
    guid: 'g',
    path: '/art/hero.psd',
    owner: 'ana.diaz',
    workspace: 'art-wk',
    status: 'Locked',
    date: '',
    destinationBranch: '/main',
    holderBranch: '/main/art',
    repository: 'game@local',
  };

  it('looks through the item, its owner, both branches and the workspace', () => {
    const matches = (search: string) => matchesWordFilter(lockFilterTexts(lock), search);
    expect(['hero.psd', 'Ana Diaz', 'ana.diaz', '/main/art', 'art-wk'].every(matches)).toBe(true);
    expect(matches('villain')).toBe(false);
  });
});
