import { describe, expect, it } from 'vitest';
import type { IncomingSummary } from '@shared/domain/incoming';
import { behindBranch, behindDescription } from './checkinBehind';

const summary = (changesetCount: number, authors: string[] = [], branch: string | null = '/main/task'): IncomingSummary => ({
  branch,
  loadedChangeset: 10,
  headChangeset: 10 + changesetCount,
  changesetCount,
  authors,
});

describe('behindBranch', () => {
  it('counts what the branch checked in to has that the workspace lacks', () => {
    expect(behindBranch(summary(2, ['ana']), '/main/task')).toEqual({ count: 2, authors: ['ana'] });
  });

  it('is null when up to date, unknown, or about another branch', () => {
    expect(behindBranch(summary(0), '/main/task')).toBeNull();
    expect(behindBranch(undefined, '/main/task')).toBeNull();
    expect(behindBranch(summary(2), '/main')).toBeNull();
    expect(behindBranch(summary(2, [], null), undefined)).toBeNull();
  });
});

describe('behindDescription', () => {
  it('names who checked in', () => {
    expect(behindDescription({ count: 1, authors: ['ana'] })).toBe('1 new changeset from Ana on this branch');
    expect(behindDescription({ count: 3, authors: ['ana', 'bob.smith@unity3d.com'] })).toBe('3 new changesets from Ana, Bob Smith on this branch');
  });

  it('counts the authors past the second', () => {
    expect(behindDescription({ count: 5, authors: ['ana', 'bob', 'carl', 'dora'] })).toBe('5 new changesets from Ana, Bob and 2 more on this branch');
  });

  it('leaves the authors out when unknown', () => {
    expect(behindDescription({ count: 2, authors: [] })).toBe('2 new changesets on this branch');
  });
});
