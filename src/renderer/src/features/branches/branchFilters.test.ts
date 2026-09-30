import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import { compactFilter } from '../../lib/compactFilter';
import { EVERYONE, MINE, matchesPeople } from '../../lib/peopleFilter';
import { isFiltering } from '../../lib/viewFilters';
import { branchesQuery, filterBranches } from './branchFilters';
import { useBranchesViewStore } from './branchesViewStore';

const today = new Date(2026, 8, 25);

const branch = (name: string, owner = 'ana.diaz', comment = ''): Branch => ({
  id: name.length,
  name,
  parent: '/main',
  comment,
  owner,
  date: '',
  headChangeset: 1,
  guid: '',
  repository: 'game@local',
});

describe('what Branches asks the server for', () => {
  it('asks for every branch with the defaults, sharing the key of every other reader of all branches', () => {
    expect(compactFilter(branchesQuery({ since: 'anyTime', people: EVERYONE, showHidden: false }, today))).toEqual(compactFilter({}));
  });

  it('puts the time range, the people picked and the hidden ones into the query', () => {
    expect(branchesQuery({ since: 'lastMonth', people: { mine: true, others: ['zoe', 'ana'] }, showHidden: true }, today)).toEqual({
      sinceDate: '2026-08-26',
      owners: ['me', 'ana', 'zoe'],
      includeHidden: true,
    });
  });

  it('asks the same query for the same people picked in any order', () => {
    const picked = (others: string[]) => branchesQuery({ since: 'anyTime', people: { mine: false, others }, showHidden: false }, today);
    expect(picked(['zoe', 'ana'])).toEqual(picked(['ana', 'zoe']));
  });

  it("asks for the user's own as `me`, whom `cm` knows as the one signed in", () => {
    expect(branchesQuery({ since: 'anyTime', people: MINE, showHidden: false }, today).owners).toEqual(['me']);
  });
});

describe('filterBranches', () => {
  const branches = [branch('/main/login', 'ana.diaz', 'New sign-in form'), branch('/main/shop', 'bob'), branch('/main/login-fix', 'bob')];
  const everyone = () => true;

  it('keeps the branches whose name, comment or creator (as shown or stored) has every word, in any order', () => {
    const names = (search: string) => filterBranches(branches, search, everyone).map((shown) => shown.name);
    expect(names('login')).toEqual(['/main/login', '/main/login-fix']);
    expect(names('form sign-in')).toEqual(['/main/login']);
    expect(names('Ana Diaz')).toEqual(['/main/login']);
    expect(names('login bob')).toEqual(['/main/login-fix']);
    expect(names('rocket')).toEqual([]);
  });

  it("narrows to the people picked at once, before the server's answer for them comes", () => {
    const picked = (owner: string) => matchesPeople({ mine: false, others: ['bob'] }, 'ana.diaz', owner);
    expect(filterBranches(branches, '', picked).map((shown) => shown.name)).toEqual(['/main/shop', '/main/login-fix']);
  });
});

describe("Branches' Clear filters", () => {
  it('shows everyone and empties the text, keeping the time range, the hidden branches and the layout', () => {
    const store = useBranchesViewStore;
    store.getState().update({ text: 'login', people: MINE, since: 'lastWeek', showHidden: true, layout: 'tree' });
    expect(isFiltering(store.getState())).toBe(true);

    store.getState().clear();

    const { text, people, since, showHidden, layout } = store.getState();
    expect({ text, people, since, showHidden, layout }).toEqual({ text: '', people: EVERYONE, since: 'lastWeek', showHidden: true, layout: 'tree' });
    expect(isFiltering(store.getState())).toBe(false);
  });
});
