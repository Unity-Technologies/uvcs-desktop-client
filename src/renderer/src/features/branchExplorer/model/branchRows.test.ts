import { describe, expect, it } from 'vitest';
import type { BranchExplorerData } from '@shared/domain/branchExplorer';
import { branch, changeset } from './graphFixtures';
import { branchesMoves, branchMoves, movedBranch, movedBranches, pinsOf, withoutPin, withPins, type BranchPins } from './branchRows';
import { layoutGraph } from './layoutGraph';

/**
 * /main 1 on row 0; /main/a 2 (columns 1..2) and /main/b 3 (columns 6..7) on row 1, /main/c 4 (columns 3..4) on row 2.
 */
function history(): BranchExplorerData {
  return {
    branches: [branch('/main', '', 5), branch('/main/a', '/main', 2), branch('/main/c', '/main', 4), branch('/main/b', '/main', 7)].map((each, index) => ({
      ...each,
      id: [1, 2, 4, 3][index]!,
    })),
    changesets: [
      changeset(0, '/main', -1),
      changeset(1, '/main', 0),
      changeset(2, '/main/a', 1),
      changeset(3, '/main', 1),
      changeset(4, '/main/c', 3),
      changeset(5, '/main', 3),
      changeset(6, '/main', 5),
      changeset(7, '/main/b', 6),
    ],
    mergeLinks: [],
    labels: [],
  };
}

function lanesOf(pins: BranchPins = []) {
  const layout = layoutGraph(history(), undefined, null, pins);
  return { layout, lane: (name: string) => layout.lanesByBranch.get(name)! };
}

describe('movedBranch', () => {
  const { layout, lane } = lanesOf();

  it('moves a branch one row up or down, or to the top or below every row', () => {
    expect(layout.rowCount).toBe(3);
    expect(movedBranch([], lane('/main/c'), 'up', layout.rowCount)).toEqual([{ branch: 4, row: 1 }]);
    expect(movedBranch([], lane('/main/c'), 'down', layout.rowCount)).toEqual([{ branch: 4, row: 3 }]);
    expect(movedBranch([], lane('/main/c'), 'top', layout.rowCount)).toEqual([{ branch: 4, row: 0 }]);
    expect(movedBranch([], lane('/main/a'), 'bottom', layout.rowCount)).toEqual([{ branch: 2, row: 3 }]);
  });

  it('keeps one position per branch, the one moved last at the end', () => {
    const pins = [{ branch: 4, row: 0 }, { branch: 3, row: 2 }];
    expect(movedBranch(pins, lane('/main/c'), 'up', layout.rowCount)).toEqual([{ branch: 3, row: 2 }, { branch: 4, row: 1 }]);
  });
});

describe('withoutPin', () => {
  it("drops one branch's position", () => {
    expect(withoutPin([{ branch: 4, row: 0 }, { branch: 3, row: 2 }], 4)).toEqual([{ branch: 3, row: 2 }]);
  });
});

describe('branchMoves', () => {
  it('offers every move a branch in the middle can make, and no reset while nothing moved', () => {
    const { layout, lane } = lanesOf();
    expect(branchMoves(layout, lane('/main/a'), [])).toEqual({ up: true, down: true, top: true, bottom: true, reset: false, resetAll: false });
  });

  it('offers no move up from the top row', () => {
    const { layout, lane } = lanesOf();
    expect(branchMoves(layout, lane('/main'), [])).toMatchObject({ up: false, top: false, down: true, bottom: true });
  });

  it('offers no move down for the only branch on the last row', () => {
    const { layout, lane } = lanesOf();
    expect(branchMoves(layout, lane('/main/c'), [])).toMatchObject({ up: true, top: true, down: false, bottom: false });
  });

  it('moves a branch sharing the last row down to a row of its own', () => {
    const pins = [{ branch: 2, row: 2 }];
    const { layout, lane } = lanesOf(pins);
    expect(layout.lanesByRow.get(2)!.map((each) => each.branch.name).sort()).toEqual(['/main/a', '/main/b']);
    expect(branchMoves(layout, lane('/main/a'), pins)).toMatchObject({ down: true, bottom: true });
  });

  it('resets a moved branch, and every branch once one moved', () => {
    const pins = [{ branch: 3, row: 2 }];
    const { layout, lane } = lanesOf(pins);
    expect(branchMoves(layout, lane('/main/b'), pins)).toMatchObject({ reset: true, resetAll: true });
    expect(branchMoves(layout, lane('/main/a'), pins)).toMatchObject({ reset: false, resetAll: true });
  });
});

describe('movedBranches', () => {
  const rowsOf = (pins: BranchPins) => {
    const { layout } = lanesOf(pins);
    return (name: string) => layout.lanesByBranch.get(name)!.row;
  };

  it('moves several branches to the top in the order they were in', () => {
    const { layout, lane } = lanesOf();
    const row = rowsOf(movedBranches([], layout, [lane('/main/c'), lane('/main/a')], 'top'));
    expect([row('/main/a'), row('/main/c')]).toEqual([0, 1]);
  });

  it('moves several branches below every other in the order they were in, whichever was picked first', () => {
    const start: BranchPins = [{ branch: 4, row: 0 }];
    const { layout, lane } = lanesOf(start);
    for (const picked of [[lane('/main/c'), lane('/main/a')], [lane('/main/a'), lane('/main/c')]]) {
      const row = rowsOf(movedBranches(start, layout, picked, 'bottom'));
      expect([row('/main/b'), row('/main/c'), row('/main/a')]).toEqual([1, 2, 3]);
    }
  });

  it('leaves the branches a move has no room for where they are', () => {
    const { layout, lane } = lanesOf();
    expect(movedBranches([], layout, [lane('/main'), lane('/main/a')], 'up')).toEqual([{ branch: 2, row: 0 }]);
  });

  it('keeps the same positions when no branch can move', () => {
    const pins: BranchPins = [{ branch: 3, row: 1 }];
    const { layout, lane } = lanesOf(pins);
    expect(movedBranches(pins, layout, [lane('/main')], 'top')).toBe(pins);
  });
});

describe('branchesMoves', () => {
  it('offers each move one of the branches can make', () => {
    const { layout, lane } = lanesOf();
    expect(branchesMoves(layout, [lane('/main'), lane('/main/c')], [])).toEqual({ up: true, down: true, top: true, bottom: true, reset: false, resetAll: false });
  });

  it('offers a reset once one of the branches moved', () => {
    const pins = [{ branch: 4, row: 2 }];
    const { layout, lane } = lanesOf(pins);
    expect(branchesMoves(layout, [lane('/main/a'), lane('/main/c')], pins)).toMatchObject({ reset: true, resetAll: true });
    expect(branchesMoves(layout, [lane('/main/a'), lane('/main')], pins)).toMatchObject({ reset: false, resetAll: true });
  });
});

describe('withPins', () => {
  it("changes only the repository's own positions, and forgets a repository without any", () => {
    const before = { game: [{ branch: 4, row: 0 }], tools: [{ branch: 3, row: 2 }] };
    expect(withPins(before, 'game', [])).toEqual({ tools: [{ branch: 3, row: 2 }] });
    expect(withPins({}, 'game', [{ branch: 4, row: 0 }])).toEqual({ game: [{ branch: 4, row: 0 }] });
    expect(before.game).toHaveLength(1);
  });
});

describe('pinsOf', () => {
  it("reads the repository's positions, the same empty list when it has none", () => {
    // The same array every time: a store selector answering a new one would render forever.
    expect(pinsOf({ game: [{ branch: 4, row: 0 }] }, 'game')).toEqual([{ branch: 4, row: 0 }]);
    expect(pinsOf({}, 'game')).toBe(pinsOf({}, undefined));
  });
});
