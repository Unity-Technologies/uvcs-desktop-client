import { describe, expect, it } from 'vitest';
import type { GraphBranch, GraphChangeset } from '@shared/domain/branchExplorer';
import { relevantBranches } from './relevantBranches';

function branch(name: string, parent: string, date = '2020-01-01'): GraphBranch {
  return { id: 0, name, parent, date, owner: '', comment: '', headChangeset: 0, isHidden: false };
}

function changeset(id: number, branchName: string): GraphChangeset {
  return { id, branch: branchName, parent: id - 1, date: '2026-09-01', owner: '', comment: '' };
}

describe('relevantBranches', () => {
  const branches = [
    branch('/main', ''),
    branch('/main/old', '/main'),
    branch('/main/a', '/main'),
    branch('/main/a/b', '/main/a'),
    branch('/main/new', '/main', '2026-09-10'),
  ];

  it('keeps branches with changesets, their ancestors and branches created in range', () => {
    const names = relevantBranches(branches, [changeset(5, '/main/a/b')], '2026-09-01').map((kept) => kept.name);
    expect(names).toEqual(['/main', '/main/a', '/main/a/b', '/main/new']);
  });
});
