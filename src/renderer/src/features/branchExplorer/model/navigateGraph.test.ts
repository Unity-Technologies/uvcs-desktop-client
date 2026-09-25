import { describe, expect, it } from 'vitest';
import { branch, changeset, merge, sampleHistory } from './graphFixtures';
import { layoutGraph } from './layoutGraph';
import {
  branchBase,
  branchEnd,
  graphEnd,
  mergeDestination,
  mergeSource,
  neighborChangeset,
  pageChangeset,
  startingChangeset,
} from './navigateGraph';

// /main: 0 1 3 6 on row 0 · /main/a: 2 4 5 on row 1 (from 1, merged into 6) · /main/b: 7 on row 2 (from 6)
const layout = layoutGraph(sampleHistory());

describe('neighborChangeset', () => {
  it('walks the branch sideways, and past its last changeset to where it was merged', () => {
    expect(neighborChangeset(layout, 3, 'left')).toBe(1);
    expect(neighborChangeset(layout, 1, 'right')).toBe(3);
    expect(neighborChangeset(layout, 5, 'right')).toBe(6);
    expect(neighborChangeset(layout, 0, 'left')).toBeNull();
  });

  it('moves up and down to the closest changeset of the nearest row', () => {
    expect(neighborChangeset(layout, 4, 'up')).toBe(3);
    expect(neighborChangeset(layout, 6, 'down')).toBe(5);
    expect(neighborChangeset(layout, 5, 'down')).toBe(7);
    expect(neighborChangeset(layout, 7, 'down')).toBeNull();
  });
});

describe('branchEnd', () => {
  it("finds a branch's oldest and newest changeset", () => {
    expect(branchEnd(layout, '/main/a', 'first')).toBe(2);
    expect(branchEnd(layout, '/main/a', 'last')).toBe(5);
    expect(branchEnd(layout, '/main', 'first')).toBe(0);
    expect(branchEnd(layout, '/main', 'last')).toBe(6);
  });

  it('lands where a branch starts when none of its changesets is shown', () => {
    const history = sampleHistory();
    history.branches.push(branch('/main/empty', '/main', 3));
    const withEmpty = layoutGraph(history);
    expect(branchEnd(withEmpty, '/main/empty', 'first')).toBe(3);
    expect(branchEnd(withEmpty, '/main/empty', 'last')).toBe(3);
    expect(branchEnd(withEmpty, '/nowhere', 'last')).toBeNull();
  });
});

describe('graphEnd', () => {
  it('finds the oldest and newest changeset of the whole graph', () => {
    expect(graphEnd(layout, 'first')).toBe(0);
    expect(graphEnd(layout, 'last')).toBe(7);
  });
});

describe('pageChangeset', () => {
  it('stays on the branch, going as far as the page reaches', () => {
    expect(pageChangeset(layout, 1, 1, 3)).toBe(3);
    expect(pageChangeset(layout, 6, -1, 10)).toBe(0);
    expect(pageChangeset(layout, 2, 1, 2)).toBe(4);
  });

  it('keeps moving through time once the branch has nothing further', () => {
    expect(pageChangeset(layout, 3, 1, 2)).toBe(5);
    expect(pageChangeset(layout, 6, 1, 5)).toBe(7);
  });

  it('stops at the ends of the graph', () => {
    expect(pageChangeset(layout, 7, 1, 3)).toBeNull();
    expect(pageChangeset(layout, 0, -1, 3)).toBeNull();
  });
});

describe('merge links', () => {
  it('jumps from a merge to its source and back to its destination', () => {
    expect(mergeSource(layout, 6)).toBe(5);
    expect(mergeDestination(layout, 5)).toBe(6);
    expect(mergeSource(layout, 3)).toBeNull();
    expect(mergeDestination(layout, 3)).toBeNull();
  });

  it('picks the latest source and the earliest destination when there are several', () => {
    const history = sampleHistory();
    history.changesets.push(changeset(8, '/main', 6, 'Merge a and b'), changeset(9, '/main/b', 7));
    history.mergeLinks.push(merge(4, 8), merge(7, 8), merge(5, 9));
    const busy = layoutGraph(history);
    expect(mergeSource(busy, 8)).toBe(7);
    expect(mergeDestination(busy, 5)).toBe(6);
  });
});

describe('branchBase', () => {
  it('finds the changeset a branch starts from', () => {
    expect(branchBase(layout, '/main/a')).toBe(1);
    expect(branchBase(layout, '/main/b')).toBe(6);
    expect(branchBase(layout, '/main')).toBeNull();
  });
});

describe('startingChangeset', () => {
  it("starts from a selected branch's latest changeset", () => {
    expect(startingChangeset(layout, '/main/a', 3)).toBe(5);
  });

  it('otherwise starts from the workspace changeset, then from the latest one', () => {
    expect(startingChangeset(layout, null, 3)).toBe(3);
    expect(startingChangeset(layout, null, 42)).toBe(7);
    expect(startingChangeset(layout, null, null)).toBe(7);
  });
});
