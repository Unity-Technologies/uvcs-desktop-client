import { describe, expect, it } from 'vitest';
import type { Branch } from '@shared/domain/branch';
import { buildBranchTree } from './branchTree';

function branch(name: string, parent = ''): Branch {
  return { id: 0, name, parent, comment: '', owner: '', date: '', headChangeset: 0, guid: name, repository: '' };
}

const branches = [branch('/main/task-2', '/main'), branch('/main'), branch('/main/task-1/sub', '/main/task-1'), branch('/main/task-1', '/main')];

describe('buildBranchTree', () => {
  it('nests branches under their parents, sorted by name', () => {
    const rows = buildBranchTree(branches, new Set());
    expect(rows.map((row) => [row.branch.name, row.depth])).toEqual([
      ['/main', 0],
      ['/main/task-1', 1],
      ['/main/task-1/sub', 2],
      ['/main/task-2', 1],
    ]);
  });

  it('hides the children of collapsed branches', () => {
    const rows = buildBranchTree(branches, new Set(['/main/task-1']));
    expect(rows.map((row) => row.branch.name)).toEqual(['/main', '/main/task-1', '/main/task-2']);
    expect(rows[1]).toMatchObject({ hasChildren: true, collapsed: true });
  });

  it('shows branches whose parent is filtered out as roots', () => {
    const rows = buildBranchTree([branch('/main/task-1/sub', '/main/task-1')], new Set());
    expect(rows).toMatchObject([{ depth: 0 }]);
  });
});
