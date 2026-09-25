import { describe, expect, it } from 'vitest';
import type { BranchExplorerData } from '@shared/domain/branchExplorer';
import { branch, changeset, merge } from './graphFixtures';
import { layoutGraph } from './layoutGraph';
import { collapseLinearRuns, structuralChangesets } from './structureOnly';

/**
 * /main:    0 ─ 1 ─ 2 ─ 3 ─ 4 ─────────── 9     (9 merges 8)
 * /main/a:          └ 5 ─ 6 ─ 7 ─ 8
 */
function longHistory(): BranchExplorerData {
  return {
    branches: [branch('/main', '', 9), branch('/main/a', '/main', 8)],
    changesets: [
      changeset(0, '/main', -1),
      changeset(1, '/main', 0),
      changeset(2, '/main', 1),
      changeset(3, '/main', 2),
      changeset(4, '/main', 3),
      changeset(5, '/main/a', 2),
      changeset(6, '/main/a', 5),
      changeset(7, '/main/a', 6),
      changeset(8, '/main/a', 7),
      changeset(9, '/main', 4),
    ],
    mergeLinks: [merge(8, 9)],
    labels: [],
  };
}

const ids = (shown: ReturnType<typeof collapseLinearRuns>): (number | string)[] =>
  shown.map(({ changeset, collapsed }) => (collapsed ? `+${collapsed.map((member) => member.id).join(',')}` : changeset.id));

describe('structuralChangesets', () => {
  it('keeps branch ends and bases, merges and labels', () => {
    const data = longHistory();
    data.labels = [{ name: 'v1', changeset: 3, owner: '', date: '', comment: '' }];
    expect([...structuralChangesets(data)].sort((a, b) => a - b)).toEqual([-1, 0, 2, 3, 5, 8, 9]);
  });
});

describe('collapseLinearRuns', () => {
  it('folds each run into a node where it starts', () => {
    const data = longHistory();
    expect(ids(collapseLinearRuns(data.changesets, structuralChangesets(data)))).toEqual([0, 1, 2, '+3,4', 5, '+6,7', 8, 9]);
  });

  it('leaves single changesets alone', () => {
    const data = longHistory();
    const keep = new Set([...structuralChangesets(data), 4, 7]);
    expect(ids(collapseLinearRuns(data.changesets, keep))).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('layoutGraph with only relevant changesets', () => {
  it('gives a collapsed run one column, and every changeset in it maps to that node', () => {
    const layout = layoutGraph(longHistory(), { keep: new Set() });
    expect(layout.columnCount).toBe(8);
    expect(layout.nodes.get(4)).toBe(layout.nodes.get(3));
    expect(layout.nodes.get(3)?.collapsed).toHaveLength(2);
    expect(layout.mergeLinks).toEqual([merge(8, 9)]);
  });

  it('keeps what it is asked to', () => {
    const layout = layoutGraph(longHistory(), { keep: new Set([6]) });
    expect(layout.nodes.get(6)?.collapsed).toBeNull();
  });
});
