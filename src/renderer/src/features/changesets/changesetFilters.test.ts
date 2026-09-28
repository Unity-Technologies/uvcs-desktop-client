import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import type { Label } from '@shared/domain/label';
import { MINE } from '../../lib/peopleFilter';
import { changesetsCap, DEFAULT_CHANGESET_FILTERS, matchesSearch, noChangesetsHint, toQueryFilter } from './changesetFilters';

const today = new Date(2026, 8, 25);

describe('toQueryFilter', () => {
  it('restricts by date by default', () => {
    expect(toQueryFilter(DEFAULT_CHANGESET_FILTERS, '/main', today)).toEqual({
      sinceDate: '2026-08-26',
      owners: undefined,
      branch: undefined,
      limit: undefined,
    });
  });

  it('applies mine and current branch, and caps "any time"', () => {
    const filter = toQueryFilter({ ...DEFAULT_CHANGESET_FILTERS, since: 'anyTime', people: MINE, onlyCurrentBranch: true }, '/main/ui', today);
    expect(filter).toEqual({ sinceDate: undefined, owners: ['me'], branch: '/main/ui', limit: 2000 });
  });

  it('asks for the people picked, so "any time" reaches their newest', () => {
    const filter = toQueryFilter({ ...DEFAULT_CHANGESET_FILTERS, since: 'anyTime', people: { mine: true, others: ['zoe', 'ana'] } }, '/main', today);
    expect(filter.owners).toEqual(['me', 'ana', 'zoe']);
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

  it('takes each word on its own, in any order, labels too', () => {
    expect(matchesSearch(changeset, 'button jane')).toBe(true);
    expect(matchesSearch(changeset, 'button rocket')).toBe(false);
    expect(matchesSearch(changeset, 'bl042 login', [{ name: 'BL042' } as Label])).toBe(true);
  });
});

describe('noChangesetsHint', () => {
  it('suggests a longer time range, which the filters look within', () => {
    expect(noChangesetsHint('lastMonth', false)).toBe('Try a longer time range.');
    expect(noChangesetsHint('lastMonth', true)).toBe('The filters look within the time range. Try a longer one.');
  });

  it("doesn't suggest a longer range than any time", () => {
    expect(noChangesetsHint('anyTime', false)).toBe('Nothing was checked in yet.');
    expect(noChangesetsHint('anyTime', true)).toBe('Any time reads the newest 2,000 changesets.');
  });
});

describe('changesetsCap', () => {
  it('says when any time stopped at its cap, and nothing while the count tells it all', () => {
    expect(changesetsCap(12, 2000, 'anyTime')).toBe('12 shown of the newest 2,000');
    expect(changesetsCap(2000, 2000, 'anyTime')).toBe('The newest 2,000');
    expect(changesetsCap(12, 40, 'anyTime')).toBeUndefined();
    expect(changesetsCap(2000, 2000, 'lastMonth')).toBeUndefined();
  });
});
