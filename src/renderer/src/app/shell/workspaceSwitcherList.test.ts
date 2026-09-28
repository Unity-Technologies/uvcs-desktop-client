import { describe, expect, it } from 'vitest';
import type { WorkspaceSummary } from '@shared/domain/workspace';
import type { WorkspaceEntry } from '../home/recentWorkspaces';
import { highlightedRow, workspaceSwitcherList } from './workspaceSwitcherList';

const workspace = (name: string): WorkspaceSummary => ({ name, path: `/work/${name}`, guid: name });
const all = [workspace('zeta'), workspace('game'), workspace('alpha'), workspace('tools')];
const names = (entries: WorkspaceEntry[]) => entries.map((entry) => entry.workspace.name);
const undescribed = (entry: WorkspaceEntry): WorkspaceEntry => entry;

describe('workspaceSwitcherList', () => {
  it('puts the recent workspaces first, in the order they were used, then the rest by name, without the open one', () => {
    const list = workspaceSwitcherList(all, ['/work/game', '/work/tools', '/work/zeta'], [], '/work/game', undescribed, '');
    expect(names(list.recent)).toEqual(['tools', 'zeta']);
    expect(names(list.others)).toEqual(['alpha']);
  });

  it('keeps recent workspaces whose folder is missing, flagged', () => {
    const list = workspaceSwitcherList(all, ['/work/old-game', '/work/tools'], ['/work/old-game'], '', undescribed, '');
    expect(list.recent.map((entry) => [entry.workspace.name, entry.missing])).toEqual([
      ['old-game', true],
      ['tools', false],
    ]);
  });

  it('filters by name, folder, repository or branch', () => {
    const described = (entry: WorkspaceEntry): WorkspaceEntry =>
      entry.workspace.name === 'tools' ? { ...entry, repository: 'pipeline@cloud', selector: { kind: 'branch', name: '/main/fix-export' } } : entry;
    expect(names(workspaceSwitcherList(all, [], [], '', described, 'pipe').others)).toEqual(['tools']);
    expect(names(workspaceSwitcherList(all, [], [], '', described, 'export').others)).toEqual(['tools']);
    expect(names(workspaceSwitcherList(all, [], [], '', undescribed, 'work alp').others)).toEqual(['alpha']);
  });
});

describe('highlightedRow', () => {
  const entries = (...workspaceNames: string[]): WorkspaceEntry[] => workspaceNames.map((name) => ({ workspace: workspace(name), missing: false }));

  it('stays on the workspace the keyboard was put on when rows come in above it, so Enter opens that one', () => {
    expect(highlightedRow(entries('tools', 'zeta'), '/work/zeta')).toBe(1);
    expect(highlightedRow(entries('old-game', 'tools', 'zeta'), '/work/zeta')).toBe(2);
  });

  it('starts on the first row, and goes back to it once its workspace is filtered out', () => {
    expect(highlightedRow(entries('tools', 'zeta'), null)).toBe(0);
    expect(highlightedRow(entries('tools'), '/work/zeta')).toBe(0);
  });
});
