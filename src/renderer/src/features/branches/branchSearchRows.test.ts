import { describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import { branchesRead, branchSearchEmptyText, branchSearchRows } from './branchSearchRows';

const branch = (name: string, comment = ''): Branch => ({
  id: 0,
  name,
  parent: '',
  comment,
  owner: '',
  date: '',
  headChangeset: 0,
  guid: name,
  repository: 'repo@server',
});

const groups = [
  { title: 'Main branch', branches: [branch('/main')] },
  { title: 'Other branches', branches: [branch('/main/boost', 'Nitro boost with cooldown'), branch('/main/hud', 'Lap counter')] },
];

describe('branchSearchRows', () => {
  it('lists every group with its branches numbered across groups', () => {
    const { rows, branches } = branchSearchRows(groups, '');
    expect(rows.map((row) => (row.type === 'group' ? row.title : `${row.index} ${row.branch.name}`))).toEqual([
      'Main branch',
      '0 /main',
      'Other branches',
      '1 /main/boost',
      '2 /main/hud',
    ]);
    expect(branches).toHaveLength(3);
  });

  it('matches words in the name or the comment and drops empty groups', () => {
    expect(branchSearchRows(groups, 'COOLDOWN').branches.map((match) => match.name)).toEqual(['/main/boost']);
    expect(branchSearchRows(groups, 'hud lap').rows).toEqual([
      { type: 'group', title: 'Other branches' },
      { type: 'branch', branch: groups[1]!.branches[1], index: 0 },
    ]);
  });

  it('finds a number inside a branch name', () => {
    const numbered = [{ title: 'Other branches', branches: [branch('/main/task1008742'), branch('/main/task1008874')] }];
    expect(branchSearchRows(numbered, '100874').branches.map((match) => match.name)).toEqual(['/main/task1008742']);
  });
});

describe('branchSearchEmptyText', () => {
  it('names the words typed that no branch matches', () => {
    expect(branchSearchEmptyText('boost', 'read')).toBe('No branches match “boost”.');
  });

  it('never quotes an empty search: a list with no branches says so, and one still loading says nothing', () => {
    expect(branchSearchEmptyText('', 'read')).toBe('No branches.');
    expect(branchSearchEmptyText('  ', 'read')).toBe('No branches.');
    expect(branchSearchEmptyText('', 'loading')).toBeNull();
  });

  it("says it couldn't read the branches, whatever was typed, instead of an empty list for good", () => {
    expect(branchSearchEmptyText('', 'failed')).toBe("Couldn't read the branches.");
    expect(branchSearchEmptyText('boost', 'failed')).toBe("Couldn't read the branches.");
  });
});

describe('branchesRead', () => {
  it('is read once there are branches, even after a later read failed', () => {
    expect(branchesRead({ data: [], isError: false })).toBe('read');
    expect(branchesRead({ data: [], isError: true })).toBe('read');
  });

  it('is loading until the first read answers, and failed when it failed', () => {
    expect(branchesRead({ data: undefined, isError: false })).toBe('loading');
    expect(branchesRead({ data: undefined, isError: true })).toBe('failed');
  });
});
