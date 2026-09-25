import type { BranchExplorerData, GraphBranch, GraphChangeset, MergeLink } from '@shared/domain/branchExplorer';

/** Test helpers to describe small histories tersely. */
export function branch(name: string, parent = '', headChangeset = 0): GraphBranch {
  return { id: 0, name, parent, headChangeset, owner: 'jane@example.com', date: '2026-09-01T00:00:00Z', comment: '', isHidden: false };
}

export function changeset(id: number, branchName: string, parent: number, comment = ''): GraphChangeset {
  return { id, branch: branchName, parent, comment, owner: 'jane@example.com', date: `2026-09-${String(id + 1).padStart(2, '0')}T00:00:00Z` };
}

export function merge(sourceChangeset: number, destinationChangeset: number): MergeLink {
  return { type: 'merge', sourceChangeset, destinationChangeset };
}

/**
 * /main:    0 ─ 1 ─── 3 ─────── 6   (6 merges 5, labeled v1)
 * /main/a:      └ 2 ──── 4 ─ 5
 * /main/b:                    └ 7   (starts from 6)
 */
export function sampleHistory(): BranchExplorerData {
  return {
    branches: [branch('/main', '', 6), branch('/main/a', '/main', 5), branch('/main/b', '/main', 7)],
    changesets: [
      changeset(0, '/main', -1),
      changeset(1, '/main', 0),
      changeset(2, '/main/a', 1),
      changeset(3, '/main', 1),
      changeset(4, '/main/a', 2),
      changeset(5, '/main/a', 4, 'Finish feature'),
      changeset(6, '/main', 3, 'Merge a'),
      changeset(7, '/main/b', 6),
    ],
    mergeLinks: [merge(5, 6)],
    labels: [{ name: 'v1', changeset: 6, owner: 'jane@example.com', date: '2026-09-07T00:00:00Z', comment: '' }],
  };
}
