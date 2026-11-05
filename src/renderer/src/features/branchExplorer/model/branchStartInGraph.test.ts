import { describe, expect, it } from 'vitest';
import { branchStartInGraph } from './branchStartInGraph';
import { branch, changeset, merge, sampleHistory } from './graphFixtures';
import { layoutGraph } from './layoutGraph';

describe('where a branch starts, in the Branch Explorer', () => {
  it("is its first changeset and that one's parent on the parent branch", () => {
    const layout = layoutGraph(sampleHistory());
    expect(branchStartInGraph(layout, '/main/a')).toEqual({ firstChangeset: 2, base: 1 });
    expect(branchStartInGraph(layout, '/main/b')).toEqual({ firstChangeset: 7, base: 6 });
  });

  it("starts nowhere for /main, whose first changeset is the root", () => {
    expect(branchStartInGraph(layoutGraph(sampleHistory()), '/main')).toEqual({ firstChangeset: 0, base: -1 });
  });

  // /main/task starts from 8 and holds 9 to 13, 13 merging /main (11) into it.
  it('stays where the branch started after a merge from its parent, and with "Only relevant changesets"', () => {
    const history = {
      branches: [branch('/main', '', 11), branch('/main/task', '/main', 13)],
      changesets: [
        changeset(8, '/main', -1),
        changeset(9, '/main/task', 8),
        changeset(10, '/main/task', 9),
        changeset(11, '/main', 8),
        changeset(12, '/main/task', 10),
        changeset(13, '/main/task', 12),
      ],
      mergeLinks: [merge(11, 13)],
      labels: [],
    };
    expect(branchStartInGraph(layoutGraph(history), '/main/task')).toEqual({ firstChangeset: 9, base: 8 });
    expect(branchStartInGraph(layoutGraph(history, { keep: new Set() }), '/main/task')).toEqual({ firstChangeset: 9, base: 8 });
  });

  it("doesn't tell when the date range left out the changeset before the branch's first one shown", () => {
    const history = {
      branches: [branch('/main', '', 20), branch('/main/task', '/main', 22)],
      changesets: [changeset(20, '/main', 19), changeset(21, '/main/task', 15), changeset(22, '/main/task', 21)],
      mergeLinks: [],
      labels: [],
    };
    expect(branchStartInGraph(layoutGraph(history), '/main/task')).toBeNull();
  });

  it("doesn't tell for a branch with no changeset in the history", () => {
    expect(branchStartInGraph(layoutGraph(sampleHistory()), '/main/gone')).toBeNull();
    const empty = { ...sampleHistory(), branches: [...sampleHistory().branches, branch('/main/empty', '/main', 6)] };
    expect(branchStartInGraph(layoutGraph(empty), '/main/empty')).toBeNull();
  });
});
