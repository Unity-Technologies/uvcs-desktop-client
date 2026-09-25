import { describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import { branchSwitcherGroups } from './branchSwitcherGroups';

const branch = (name: string, parent = ''): Branch => ({
  id: 1,
  name,
  parent,
  comment: '',
  owner: 'me',
  date: '',
  headChangeset: 1,
  guid: name,
  repository: 'repo@local',
});

const branches = [branch('/main/zeta', '/main'), branch('/main'), branch('/main/alpha', '/main'), branch('/main/task', '/main')];
const names = (groups: ReturnType<typeof branchSwitcherGroups>) => groups.map((group) => [group.title, group.branches.map((b) => b.name)]);

describe('branchSwitcherGroups', () => {
  it('lists each branch once: main, then recent, then the rest by name', () => {
    expect(names(branchSwitcherGroups(branches, ['/main/task', '/main']))).toEqual([
      ['Main branch', ['/main']],
      ['Recent', ['/main/task']],
      ['Other branches', ['/main/alpha', '/main/zeta']],
    ]);
  });

  it('skips recent branches that no longer exist', () => {
    expect(branchSwitcherGroups(branches, ['/main/gone'])[1]!.branches).toEqual([]);
  });

  it('calls the rest "All branches" when nothing is listed above them', () => {
    expect(branchSwitcherGroups([branch('/main/a', '/main')], [])[2]!.title).toBe('All branches');
  });
});
