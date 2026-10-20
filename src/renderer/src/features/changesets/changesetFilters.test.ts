import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import type { Label } from '@shared/domain/label';
import { compactFilter } from '../../lib/compactFilter';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { isFiltering } from '../../lib/viewFilters';
import { changesetChoices, changesetsCap, CLEARED_CHANGESET_FILTERS, DEFAULT_CHANGESET_FILTERS, matchesSearch, noChangesetsHint, toQueryFilter } from './changesetFilters';
import { useChangesetFilters } from './changesetsViewStore';

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

  it('leaves the branch out while only the current branch is asked for but none is known (a label loaded)', () => {
    expect(compactFilter(toQueryFilter({ ...DEFAULT_CHANGESET_FILTERS, onlyCurrentBranch: true }, undefined, today))).toEqual({ sinceDate: '2026-08-26' });
  });
});

describe("Changesets' Clear filters", () => {
  it('shows everyone, empties the text and every branch again, keeping the time range', () => {
    const store = useChangesetFilters;
    store.getState().update({ text: 'fix', people: MINE, since: 'lastYear', onlyCurrentBranch: true });

    store.getState().clear();

    const { text, people, since, onlyCurrentBranch } = store.getState();
    expect({ text, people, since, onlyCurrentBranch }).toEqual({ text: '', people: EVERYONE, since: 'lastYear', onlyCurrentBranch: false });
    expect(isFiltering(store.getState(), CLEARED_CHANGESET_FILTERS)).toBe(false);
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

describe('changesetChoices', () => {
  const changeset = (id: number, comment = '', branch = '/main'): Changeset => ({ id, guid: `g${id}`, branch, comment, owner: 'ana', date: '', parent: id - 1, repository: 'game@local' });
  const recent = [changeset(50, 'Fix the menu'), changeset(42, 'Add the menu\nWith its icons', '/main/ui'), changeset(41, 'Ship 42 levels')];
  /** More than the three read: the read stopped at its limit, so older changesets exist. */
  const NOT_REACHED = 10;
  const choices = (search: string, read: readonly Changeset[] | undefined = recent, limit = NOT_REACHED) => changesetChoices(read, limit, 50, search);
  const ids = (search: string) => choices(search).map((choice) => choice.id);

  it('offers the newest changesets read, leaving out the one being compared', () => {
    expect(ids('')).toEqual([42, 41]);
  });

  it("looks through what a row shows: the number, the comment's first line, the branch's own name", () => {
    expect(ids('menu')).toEqual([42]);
    expect(ids('ship levels')).toEqual([41]);
    expect(ids('ui')).toEqual([42]);
    expect(ids('icons')).toEqual([]);
    expect(ids('ana')).toEqual([]);
  });

  it('puts a changeset typed by number first, with its row when it was read, then the others that mention it', () => {
    expect(choices('42')).toEqual([{ id: 42, changeset: recent[1] }, { id: 41, changeset: recent[2] }]);
    expect(ids('cs:41')).toEqual([41]);
  });

  it('offers a changeset older than those read by its number alone, when the read stopped at its limit', () => {
    expect(choices('7', recent, 3)).toEqual([{ id: 7 }]);
  });

  it('offers a changeset newer than those read: checked in since', () => {
    expect(choices('60')).toEqual([{ id: 60 }]);
  });

  it("says a number names no changeset when the read had every changeset there, or one between those read", () => {
    expect(choices('7')).toEqual([{ id: 7, missing: true }]);
    expect(choices('45', recent, 3)).toEqual([{ id: 45, missing: true }]);
  });

  it('offers any number typed while the changesets are unread, or the read failed', () => {
    expect(choices('7', undefined)).toEqual([{ id: 7 }]);
    expect(choices('', undefined)).toEqual([]);
  });

  it('never offers the changeset being compared, even typed', () => {
    expect(ids('50')).toEqual([]);
  });
});
