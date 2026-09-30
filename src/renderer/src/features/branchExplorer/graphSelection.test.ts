import { describe, expect, it } from 'vitest';
import { selectionFor } from './graphSelection';
import { sampleHistory } from './model/graphFixtures';
import { layoutGraph } from './model/layoutGraph';

const layout = layoutGraph(sampleHistory());
const label = { name: 'v1', changeset: 6, owner: 'jane@example.com', date: '', comment: '' };

describe('selectionFor what was clicked in the graph', () => {
  it('selects a changeset, a branch or the pending changes as themselves', () => {
    expect(selectionFor({ kind: 'changeset', id: 4 })).toEqual({ kind: 'changeset', id: 4 });
    expect(selectionFor({ kind: 'branch', lane: layout.lanesByBranch.get('/main/a')! })).toEqual({ kind: 'branch', name: '/main/a' });
    expect(selectionFor({ kind: 'pending' })).toEqual({ kind: 'pending' });
  });

  it("selects a label's changeset, naming the label so the details show it", () => {
    expect(selectionFor({ kind: 'label', label, more: [] })).toEqual({ kind: 'changeset', id: 6, label: 'v1' });
  });

  it('selects the changeset a merge went into, and where a merge in progress comes from', () => {
    expect(selectionFor({ kind: 'mergeLink', link: { type: 'merge', sourceChangeset: 5, destinationChangeset: 6 } })).toEqual({ kind: 'changeset', id: 6 });
    expect(selectionFor({ kind: 'pendingMergeLink', link: { type: 'cherryPick', sourceChangeset: 3 } })).toEqual({ kind: 'changeset', id: 3 });
  });

  it('selects nothing for empty space, nor for a "+N" node, which expands instead', () => {
    expect(selectionFor(null)).toBeNull();
    expect(selectionFor({ kind: 'collapsed', node: layout.nodesByColumn[0]! })).toBeNull();
  });
});
