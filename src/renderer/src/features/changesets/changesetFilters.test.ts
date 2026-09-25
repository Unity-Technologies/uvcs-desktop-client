import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { DEFAULT_CHANGESET_FILTER, matchesSearch, toQueryFilter } from './changesetFilters';

const today = new Date(2026, 8, 25);

describe('toQueryFilter', () => {
  it('restricts by date by default', () => {
    expect(toQueryFilter(DEFAULT_CHANGESET_FILTER, '/main', today)).toEqual({
      sinceDate: '2026-08-26',
      owner: undefined,
      branch: undefined,
      limit: undefined,
    });
  });

  it('applies mine and current branch, and caps "any time"', () => {
    const filter = toQueryFilter({ ...DEFAULT_CHANGESET_FILTER, datePreset: 'all', onlyMine: true, onlyCurrentBranch: true }, '/main/ui', today);
    expect(filter).toEqual({ sinceDate: undefined, owner: 'me', branch: '/main/ui', limit: 2000 });
  });
});

describe('matchesSearch', () => {
  const changeset: Changeset = {
    id: 42,
    guid: 'g',
    branch: '/main/login',
    comment: 'Fix the login button',
    owner: 'jane.doe@unity3d.com',
    date: '',
    parent: 41,
    repository: 'r@s',
  };

  it('matches the id, comment, author and branch case-insensitively', () => {
    expect(['42', 'LOGIN BUTTON', 'jane', 'main/login'].every((search) => matchesSearch(changeset, search))).toBe(true);
    expect(matchesSearch(changeset, 'checkout')).toBe(false);
  });
});
