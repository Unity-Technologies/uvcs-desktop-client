import { describe, expect, it } from 'vitest';
import type { GraphSelection } from '../graphSelection';
import { sampleHistory } from './graphFixtures';
import { movedSelection, selectedBranchOf, type GraphMove } from './keyboardMoves';
import { layoutGraph } from './layoutGraph';

// /main: 0 1 3 6 on row 0 · /main/a: 2 4 5 on row 1 (from 1, merged into 6) · /main/b: 7 on row 2 (from 6)
const layout = layoutGraph(sampleHistory());
// The same with the workspace's pending changes on /main/a, loaded at 5.
const withPending = layoutGraph(sampleHistory(), undefined, { branch: '/main/a', parent: 5, mergeLinks: [] });

const changeset = (id: number): GraphSelection => ({ kind: 'changeset', id });
const branch = (name: string): GraphSelection => ({ kind: 'branch', name });
const pending: GraphSelection = { kind: 'pending' };
const right: GraphMove = { kind: 'walk', direction: 'right' };

describe('keyboard moves through the Branch Explorer', () => {
  it('starts the first arrow from the workspace changeset, else the newest', () => {
    expect(movedSelection(layout, null, 4, right)).toEqual(changeset(4));
    expect(movedSelection(layout, null, null, right)).toEqual(changeset(7));
  });

  it("starts the first arrow from a selected branch's newest changeset, not moving past it", () => {
    expect(movedSelection(layout, branch('/main/a'), 3, right)).toEqual(changeset(5));
  });

  it('walks from the selected changeset, a label selecting its changeset alike', () => {
    expect(movedSelection(layout, changeset(4), null, right)).toEqual(changeset(5));
    expect(movedSelection(layout, { kind: 'changeset', id: 3, label: 'v0' }, null, right)).toEqual(changeset(6));
  });

  it('walks right from the branch newest into the pending changes and back', () => {
    expect(movedSelection(withPending, changeset(5), 5, right)).toEqual(pending);
    expect(movedSelection(withPending, pending, 5, { kind: 'walk', direction: 'left' })).toEqual(changeset(5));
  });

  it("goes to the ends of the selection's branch, the pending changes counting as on theirs", () => {
    expect(movedSelection(layout, changeset(4), null, { kind: 'branchEdge', edge: 'first' })).toEqual(changeset(2));
    expect(movedSelection(layout, branch('/main'), null, { kind: 'branchEdge', edge: 'last' })).toEqual(changeset(6));
    expect(movedSelection(withPending, pending, 5, { kind: 'branchEdge', edge: 'first' })).toEqual(changeset(2));
    expect(movedSelection(layout, null, 4, { kind: 'branchEdge', edge: 'last' })).toBeNull();
  });

  it('goes to the oldest and newest changeset of the graph from anywhere', () => {
    expect(movedSelection(layout, branch('/main/a'), null, { kind: 'graphEdge', edge: 'first' })).toEqual(changeset(0));
    expect(movedSelection(layout, null, null, { kind: 'graphEdge', edge: 'last' })).toEqual(changeset(7));
  });

  it('pages from the selected changeset, or from where the arrows would start', () => {
    expect(movedSelection(layout, changeset(0), null, { kind: 'page', step: 1, columns: 3 })).toEqual(changeset(3));
    expect(movedSelection(withPending, pending, 5, { kind: 'page', step: -1, columns: 2 })).toEqual(changeset(4));
  });

  it('jumps along merges only from a selected changeset', () => {
    expect(movedSelection(layout, changeset(6), null, { kind: 'mergeSource' })).toEqual(changeset(5));
    expect(movedSelection(layout, changeset(5), null, { kind: 'mergeDestination' })).toEqual(changeset(6));
    expect(movedSelection(layout, branch('/main'), 6, { kind: 'mergeSource' })).toBeNull();
    expect(movedSelection(layout, changeset(4), null, { kind: 'mergeSource' })).toBeNull();
  });

  it("goes to where the selection's branch starts", () => {
    expect(movedSelection(layout, changeset(4), null, { kind: 'branchBase' })).toEqual(changeset(1));
    expect(movedSelection(layout, branch('/main/b'), null, { kind: 'branchBase' })).toEqual(changeset(6));
    expect(movedSelection(layout, changeset(3), null, { kind: 'branchBase' })).toBeNull();
    expect(movedSelection(layout, null, 4, { kind: 'branchBase' })).toBeNull();
  });
});

describe('selectedBranchOf', () => {
  it('is the branch selected, or the branch of the selected changeset or pending changes', () => {
    expect(selectedBranchOf(layout, branch('/main/b'))).toBe('/main/b');
    expect(selectedBranchOf(layout, changeset(4))).toBe('/main/a');
    expect(selectedBranchOf(withPending, pending)).toBe('/main/a');
    expect(selectedBranchOf(layout, pending)).toBeNull();
    expect(selectedBranchOf(layout, changeset(99))).toBeNull();
    expect(selectedBranchOf(layout, null)).toBeNull();
  });
});
