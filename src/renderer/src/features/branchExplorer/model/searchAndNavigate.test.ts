import { describe, expect, it } from 'vitest';
import { sampleHistory } from './graphFixtures';
import { layoutGraph } from './layoutGraph';
import { neighborChangeset } from './navigateGraph';
import { searchGraph, searchHighlight, type SearchHit } from './searchGraph';

const layout = layoutGraph(sampleHistory());

describe('searchGraph', () => {
  const changeset = (id: number) => ({ kind: 'changeset', id });

  it('finds a changeset by number', () => {
    expect(searchGraph(layout, 'cs:5')).toEqual([changeset(5)]);
    expect(searchGraph(layout, '5')).toEqual([changeset(5)]);
    expect(searchGraph(layout, '99')).toEqual([]);
  });

  it('finds changesets by comment and owner, left to right', () => {
    expect(searchGraph(layout, 'finish')).toEqual([changeset(5)]);
    expect(searchGraph(layout, 'jane').map((hit) => hit.kind === 'changeset' && hit.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('finds a branch by name as the branch itself, not its changesets', () => {
    expect(searchGraph(layout, '/main/a')).toEqual([{ kind: 'branch', name: '/main/a' }]);
  });

  it('finds a label as the label, not its changeset', () => {
    expect(searchGraph(layout, 'v1')).toEqual([{ kind: 'label', name: 'v1', changeset: 6 }]);
  });

  it('returns nothing for an empty query', () => {
    expect(searchGraph(layout, '  ')).toEqual([]);
  });
});

describe('searchHighlight', () => {
  it('splits hits by kind and keeps the current one', () => {
    const hits = searchGraph(layout, 'main');
    const highlight = searchHighlight(layout, hits, hits[0]!);
    expect([...highlight.branches]).toEqual(['/main', '/main/a', '/main/b']);
    expect(highlight.changesets.size).toBe(0);
    expect(highlight.active).toEqual({ kind: 'branch', name: '/main' });
  });

  it('lights the branches holding a changeset hit', () => {
    const hits: SearchHit[] = [{ kind: 'changeset', id: 2 }];
    const highlight = searchHighlight(layout, hits, null);
    expect([...highlight.litBranches]).toEqual([layout.nodes.get(2)!.changeset.branch]);
    expect(highlight.branches.size).toBe(0);
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
