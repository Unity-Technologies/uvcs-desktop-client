import { describe, expect, it } from 'vitest';
import { MAIN_BRANCH_GUID, type Branch } from '@shared/domain/branch';
import { branchSwitcherGroups } from './branchSwitcherGroups';

const branch = (name: string, date: string, guid = name): Branch => ({
  id: 1,
  name,
  parent: name === '/main' ? '' : '/main',
  comment: '',
  owner: 'me',
  date,
  headChangeset: 1,
  guid,
  repository: 'repo@local',
});

const main = branch('/main', '2010-01-01T00:00:00+01:00', MAIN_BRANCH_GUID.toUpperCase());
const branches = [
  branch('/main/old', '2026-09-01T10:00:00+02:00'),
  main,
  branch('/release', '2026-09-20T10:00:00+02:00'),
  branch('/main/newest', '2026-09-25T09:00:00+02:00'),
  branch('/main/recent-a', '2026-09-10T10:00:00+02:00'),
  branch('/main/recent-b', '2026-09-23T10:00:00+02:00'),
  // Same instant as /release in another time zone.
  branch('/main/utc', '2026-09-24T08:00:00Z'),
];
const names = (groups: ReturnType<typeof branchSwitcherGroups>) => groups.map((group) => [group.title, group.branches.map((b) => b.name)]);

describe('branchSwitcherGroups', () => {
  it('lists /main, the recent branches in switch order, then the rest newest first', () => {
    expect(names(branchSwitcherGroups(branches, ['/main/recent-a', '/main/recent-b']))).toEqual([
      ['Main branch', ['/main']],
      ['Recent branches', ['/main/recent-a', '/main/recent-b']],
      ['Other branches', ['/main/newest', '/main/utc', '/release', '/main/old']],
    ]);
  });

  it('knows /main by its GUID, not by being top-level or by its name', () => {
    const renamed = { ...main, name: '/trunk' };
    expect(names(branchSwitcherGroups([renamed, branch('/main', '2026-01-01T00:00:00Z', 'x')], []))).toEqual([
      ['Main branch', ['/trunk']],
      ['Recent branches', []],
      ['Other branches', ['/main']],
    ]);
  });

  it('skips recent branches that are gone or hidden, and /main or repeats among them', () => {
    const groups = branchSwitcherGroups(branches, ['/main/gone', MAIN_BRANCH_GUID, '/MAIN/RECENT-B', '/main/recent-b']);
    expect(groups[1]!.branches.map((b) => b.name)).toEqual(['/main/recent-b']);
    expect(groups.flatMap((group) => group.branches)).toHaveLength(branches.length);
  });
});
