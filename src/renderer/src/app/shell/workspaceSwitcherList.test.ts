import { describe, expect, it } from 'vitest';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import type { WorkspaceEntry } from '../home/recentWorkspaces';
import { workspaceSwitcherList } from './workspaceSwitcherList';

const workspace = (name: string): WorkspaceSummary => ({ name, path: `/work/${name}`, guid: name });
const all = [workspace('zeta'), workspace('game'), workspace('alpha'), workspace('tools')];
const names = (entries: WorkspaceEntry[]) => entries.map((entry) => entry.workspace.name);

describe('workspaceSwitcherList', () => {
  it('puts the recent workspaces first, in the order they were used, then the rest by name, without the open one', () => {
    const list = workspaceSwitcherList(all, ['/work/game', '/work/tools', '/work/zeta'], [], '/work/game', undefined, '');
    expect(names(list.recent)).toEqual(['tools', 'zeta']);
    expect(names(list.others)).toEqual(['alpha']);
  });

  it('keeps recent workspaces whose folder is missing, flagged', () => {
    const list = workspaceSwitcherList(all, ['/work/old-game', '/work/tools'], ['/work/old-game'], '', undefined, '');
    expect(list.recent.map((entry) => [entry.workspace.name, entry.missing])).toEqual([
      ['old-game', true],
      ['tools', false],
    ]);
  });

  it('filters by name, folder or repository', () => {
    const repositories = { '/work/tools': 'pipeline@cloud' };
    expect(names(workspaceSwitcherList(all, [], [], '', repositories, 'pipe').others)).toEqual(['tools']);
    expect(names(workspaceSwitcherList(all, [], [], '', undefined, 'work alp').others)).toEqual(['alpha']);
  });
});
