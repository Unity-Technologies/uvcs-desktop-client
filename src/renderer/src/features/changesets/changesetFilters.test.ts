import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import { changesetsCount, DEFAULT_CHANGESET_FILTER, matchesSearch, noChangesetsHint, toQueryFilter } from './changesetFilters';

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

  it('matches the author as the table shows it', () => {
    expect(matchesSearch(changeset, 'Jane Doe')).toBe(true);
  });
});

describe('noChangesetsHint', () => {
  it('suggests a longer time range, which the search looks within', () => {
    expect(noChangesetsHint(DEFAULT_CHANGESET_FILTER)).toBe('Try a longer time range.');
    expect(noChangesetsHint({ ...DEFAULT_CHANGESET_FILTER, search: '1234' })).toBe('The search looks within the time range. Try a longer one.');
  });

  it("doesn't suggest a longer range than any time", () => {
    expect(noChangesetsHint({ ...DEFAULT_CHANGESET_FILTER, datePreset: 'all', onlyMine: true })).toBe('Try fewer filters.');
    expect(noChangesetsHint({ ...DEFAULT_CHANGESET_FILTER, datePreset: 'all', search: 'old' })).toBe('Any time reads the newest 2,000 changesets.');
  });
});

describe('changesetsCount', () => {
  it('says when any time stopped at its cap', () => {
    expect(changesetsCount(12, 2000, 'all')).toBe('12 shown of the newest 2,000');
    expect(changesetsCount(12, 40, 'all')).toBe('12 shown');
    expect(changesetsCount(2000, 2000, 'month')).toBe('2000 shown');
  });
});
