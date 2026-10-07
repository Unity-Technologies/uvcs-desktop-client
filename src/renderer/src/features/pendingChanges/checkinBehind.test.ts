import { describe, expect, it } from 'vitest';
import type { BranchIncoming } from '@shared/domain/incoming';
import { behindBranch, behindDescription } from './checkinBehind';

const summary = (changesetCount: number, authors: string[] = [], branch = '/main/task', countCapped = false): BranchIncoming => ({
  branch,
  loadedChangeset: 10,
  headChangeset: 10 + changesetCount,
  changesetCount,
  countCapped,
  authors,
});

describe('behindBranch', () => {
  it('counts what the branch checked in to has that the workspace lacks', () => {
    expect(behindBranch(summary(2, ['ana']), '/main/task', false)).toEqual({ count: 2, countCapped: false, authors: ['ana'] });
    expect(behindBranch(summary(100, ['ana'], '/main/task', true), '/main/task', false)).toEqual({ count: 100, countCapped: true, authors: ['ana'] });
  });

  it('is null when up to date, unknown, or about another branch', () => {
    expect(behindBranch(summary(0), '/main/task', false)).toBeNull();
    expect(behindBranch(undefined, '/main/task', false)).toBeNull();
    expect(behindBranch(summary(2), '/main', false)).toBeNull();
    expect(behindBranch({ branch: null, changesetCount: 0, countCapped: false, authors: [] }, undefined, false)).toBeNull();
  });

  it('is null while a merge is pending: checking in completes it as it is, without updating first', () => {
    expect(behindBranch(summary(2, ['ana']), '/main/task', true)).toBeNull();
  });
});

describe('behindDescription', () => {
  it('names who checked in', () => {
    expect(behindDescription({ count: 1, countCapped: false, authors: ['ana'] })).toBe('1 new changeset from Ana on this branch');
    expect(behindDescription({ count: 3, countCapped: false, authors: ['ana', 'bob.smith@unity3d.com'] })).toBe('3 new changesets from Ana, Bob Smith on this branch');
  });

  it('says 100+ once the incoming check stopped counting', () => {
    expect(behindDescription({ count: 100, countCapped: true, authors: ['ana'] })).toBe('100+ new changesets from Ana on this branch');
  });

  it('counts the authors past the second', () => {
    expect(behindDescription({ count: 5, countCapped: false, authors: ['ana', 'bob', 'carl', 'dora'] })).toBe('5 new changesets from Ana, Bob and 2 more on this branch');
  });

  it('leaves the authors out when unknown', () => {
    expect(behindDescription({ count: 2, authors: [] })).toBe('2 new changesets on this branch');
  });
});
