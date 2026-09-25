import { describe, expect, it } from 'vitest';
import { sampleHistory } from './graphFixtures';
import { layoutGraph } from './layoutGraph';
import { neighborChangeset } from './navigateGraph';
import { searchGraph } from './searchGraph';

const layout = layoutGraph(sampleHistory());

describe('searchGraph', () => {
  it('finds a changeset by number', () => {
    expect(searchGraph(layout, 'cs:5')).toEqual([5]);
    expect(searchGraph(layout, '5')).toEqual([5]);
  });

  it('finds changesets by comment, branch and label', () => {
    expect(searchGraph(layout, 'finish')).toEqual([5]);
    expect(searchGraph(layout, '/main/a')).toEqual([2, 4, 5]);
    expect(searchGraph(layout, 'v1')).toEqual([6]);
  });

  it('returns nothing for an empty query', () => {
    expect(searchGraph(layout, '  ')).toEqual([]);
  });
});

describe('neighborChangeset', () => {
  it('moves left to the parent, even across branches', () => {
    expect(neighborChangeset(layout, 2, 'left')).toBe(1);
  });

  it('moves right along the branch, then to where it was merged', () => {
    expect(neighborChangeset(layout, 4, 'right')).toBe(5);
    expect(neighborChangeset(layout, 5, 'right')).toBe(6);
  });

  it('moves down and up to the closest changeset on the nearest row', () => {
    expect(neighborChangeset(layout, 3, 'down')).toBe(2);
    expect(neighborChangeset(layout, 4, 'up')).toBe(3);
    expect(neighborChangeset(layout, 0, 'up')).toBeNull();
  });
});
