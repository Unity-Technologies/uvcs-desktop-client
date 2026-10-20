import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import type { Label } from '@shared/domain/label';
import { compactFilter } from '../../lib/compactFilter';
import { EVERYONE, MINE } from '../../lib/peopleFilter';
import { isFiltering, rememberedFilters } from '../../lib/viewFilters';
import {
  ALL_BRANCHES,
  branchOf,
  branchScopeIn,
  type BranchScope,
  CHANGESET_SESSION_FILTERS,
  changesetsCap,
  CLEARED_CHANGESET_FILTERS,
  CURRENT_BRANCH,
  DEFAULT_CHANGESET_FILTERS,
  isFilteringChangesets,
  matchesSearch,
  noChangesetsHint,
  pickedBranchFilters,
  toQueryFilter,
} from './changesetFilters';
import { useChangesetFilters } from './changesetsViewStore';

const today = new Date(2026, 8, 25);

const WORKSPACE = '/ws';
const ALL = { kind: 'all' } as const;

describe('toQueryFilter', () => {
  it('restricts by date by default', () => {
    expect(toQueryFilter(DEFAULT_CHANGESET_FILTERS, undefined, today)).toEqual({
      sinceDate: '2026-08-26',
      owners: undefined,
      branch: undefined,
      limit: undefined,
    });
  });

  it('applies mine and a branch, and caps "any time"', () => {
    const filter = toQueryFilter({ since: 'anyTime', people: MINE }, '/main/ui', today);
    expect(filter).toEqual({ sinceDate: undefined, owners: ['me'], branch: '/main/ui', limit: 2000 });
  });

  it('asks for the people picked, so "any time" reaches their newest', () => {
    const filter = toQueryFilter({ since: 'anyTime', people: { mine: true, others: ['zoe', 'ana'] } }, undefined, today);
    expect(filter.owners).toEqual(['me', 'ana', 'zoe']);
  });

  it('asks for a branch picked by name as written, nested and non-ASCII', () => {
    const name = '/main/características-del-niño/日本語のブランチ名-テスト';
    const scope = branchScopeIn(pickedBranchFilters(WORKSPACE, name), WORKSPACE, '/main');
    expect(toQueryFilter(DEFAULT_CHANGESET_FILTERS, branchOf(scope), today).branch).toBe(name);
  });

  // One query key, one `cm find`: the view keys its query by the compacted filter (`useChangesets`).
  it('asks the same query for "This branch" and the same branch picked by name', () => {
    const current = branchScopeIn(CURRENT_BRANCH, WORKSPACE, '/main/ui');
    const picked = branchScopeIn(pickedBranchFilters(WORKSPACE, '/main/ui'), WORKSPACE, '/main/ui');
    const queryOf = (scope: BranchScope) => compactFilter(toQueryFilter(DEFAULT_CHANGESET_FILTERS, branchOf(scope), today));
    expect(queryOf(current)).toEqual(queryOf(picked));
    expect(queryOf(current)).toEqual({ sinceDate: '2026-08-26', branch: '/main/ui' });
  });
});

describe('branchScopeIn', () => {
  it('reads every branch, the workspace\'s own, or the one picked', () => {
    expect(branchScopeIn(ALL_BRANCHES, WORKSPACE, '/main')).toEqual(ALL);
    expect(branchScopeIn(CURRENT_BRANCH, WORKSPACE, '/main/ui')).toEqual({ kind: 'current', name: '/main/ui' });
    expect(branchScopeIn(pickedBranchFilters(WORKSPACE, '/main/task'), WORKSPACE, '/main/ui')).toEqual({ kind: 'picked', name: '/main/task' });
  });

  it('reads every branch while "This branch" has none to follow (a label loaded)', () => {
    expect(branchScopeIn(CURRENT_BRANCH, WORKSPACE, undefined)).toEqual(ALL);
  });

  // The store outlives the workspace a window shows; another repository may have no such branch, or another one.
  it('leaves out a branch picked in another workspace', () => {
    expect(branchScopeIn(pickedBranchFilters('/other', '/main/task'), WORKSPACE, '/main')).toEqual(ALL);
  });
});

describe('isFilteringChangesets', () => {
  it('is on with a branch that applies here, and off with one that does not', () => {
    const filters = { ...DEFAULT_CHANGESET_FILTERS, ...pickedBranchFilters('/other', '/main/task') };
    expect(isFilteringChangesets(filters, branchScopeIn(filters, WORKSPACE, '/main'))).toBe(false);
    expect(isFilteringChangesets(filters, branchScopeIn(filters, '/other', '/main'))).toBe(true);
    expect(isFilteringChangesets({ ...DEFAULT_CHANGESET_FILTERS, text: 'fix' }, ALL)).toBe(true);
  });
});

describe("Changesets' Clear filters", () => {
  it('shows everyone, empties the text and every branch again, keeping the time range', () => {
    const store = useChangesetFilters;
    store.getState().update({ text: 'fix', people: MINE, since: 'lastYear', ...pickedBranchFilters(WORKSPACE, '/main/task') });

    store.getState().clear();

    const { text, people, since, onlyCurrentBranch, pickedBranch } = store.getState();
    expect({ text, people, since, onlyCurrentBranch, pickedBranch }).toEqual({ text: '', people: EVERYONE, since: 'lastYear', onlyCurrentBranch: false, pickedBranch: null });
    expect(isFiltering(store.getState(), CLEARED_CHANGESET_FILTERS)).toBe(false);
  });
});

describe("Changesets' remembered filters", () => {
  it('keep "This branch" across sessions and a branch picked by name for the session', () => {
    expect(rememberedFilters({ ...DEFAULT_CHANGESET_FILTERS, ...CURRENT_BRANCH }, CHANGESET_SESSION_FILTERS)).toMatchObject({ onlyCurrentBranch: true });
    const remembered = rememberedFilters({ ...DEFAULT_CHANGESET_FILTERS, ...pickedBranchFilters(WORKSPACE, '/main/task') }, CHANGESET_SESSION_FILTERS);
    expect(remembered).not.toHaveProperty('pickedBranch');
    expect(remembered).toMatchObject({ onlyCurrentBranch: false });
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
