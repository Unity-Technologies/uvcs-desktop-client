import { describe, expect, it } from 'vitest';
import { branch, changeset, merge, sampleHistory } from './graphFixtures';
import { layoutGraph } from './layoutGraph';
import { neighborChangeset } from './navigateGraph';
import { firstHitIndex, searchGraph, searchHighlight, type SearchHit } from './searchGraph';

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

describe('searchGraph with numbers in names', () => {
  /**
   * /main:              0 ─── 3 (release-100874) ─ 12 (merges 1)
   * /main/scm1008742:   └ 1
   * /main/scm1008874:   └ 2
   */
  const numbered = layoutGraph({
    branches: [branch('/main', '', 12), branch('/main/scm1008742', '/main', 1), branch('/main/scm1008874', '/main', 2)],
    changesets: [
      changeset(0, '/main', -1),
      changeset(1, '/main/scm1008742', 0, 'Fix the Crash in the pending changes'),
      changeset(2, '/main/scm1008874', 0, 'Retry after cs:12 failed'),
      changeset(3, '/main', 0, 'Prepare the release'),
      changeset(12, '/main', 3, 'Merge scm1008742'),
    ],
    mergeLinks: [merge(1, 12)],
    labels: [{ name: 'release-100874', changeset: 3, owner: 'jane@example.com', date: '2026-09-04T00:00:00Z', comment: '' }],
  });
  const kinds = (query: string) => searchGraph(numbered, query).map((hit) => (hit.kind === 'changeset' ? `cs:${hit.id}` : hit.name));

  it('finds a number inside a branch name, a label and a comment', () => {
    expect(kinds('100874')).toEqual(expect.arrayContaining(['/main/scm1008742', 'release-100874', 'cs:12']));
    expect(kinds('100874')).not.toContain('/main/scm1008874');
    expect(kinds('08874')).toEqual(['/main/scm1008874']);
  });

  it('matches any part of the full name, in any case', () => {
    expect(kinds('MAIN/SCM1008')).toEqual(expect.arrayContaining(['/main/scm1008742', '/main/scm1008874']));
    expect(kinds('scm1008742')).toEqual(expect.arrayContaining(['/main/scm1008742', 'cs:12']));
  });

  it('finds the changeset a number names, and the text holding the number too', () => {
    expect(kinds('cs:12')).toEqual(expect.arrayContaining(['cs:2', 'cs:12']));
    expect(kinds('CS:12')).toEqual(kinds('cs:12'));
    expect(kinds('12')).toEqual(expect.arrayContaining(['cs:2', 'cs:12']));
    expect(kinds('3')).toEqual(['cs:3']);
  });

  it('finds comments by any of their words, in any case and order', () => {
    expect(kinds('crash pending')).toEqual(['cs:1']);
    expect(kinds('PENDING the crash')).toEqual(['cs:1']);
    expect(kinds('crash release')).toEqual([]);
  });

  it('needs every word in the same name', () => {
    expect(kinds('scm 742')).toEqual(expect.arrayContaining(['/main/scm1008742']));
    expect(kinds('scm 742')).not.toContain('/main/scm1008874');
  });

  it('keeps the hits left to right', () => {
    const hits = searchGraph(numbered, '100874');
    const columns = hits.map((hit) =>
      hit.kind === 'branch' ? numbered.lanes.find((lane) => lane.branch.name === hit.name)!.firstOwnColumn : numbered.nodes.get(hit.kind === 'label' ? hit.changeset : hit.id)!.column,
    );
    expect(columns).toEqual([...columns].sort((a, b) => a! - b!));
  });

  it('lands the first Enter on the changeset a number names', () => {
    const hits = searchGraph(numbered, 'cs:12');
    expect(hits[firstHitIndex(hits, 'cs:12')]).toEqual({ kind: 'changeset', id: 12 });
    expect(firstHitIndex(searchGraph(numbered, '100874'), '100874')).toBe(0);
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
