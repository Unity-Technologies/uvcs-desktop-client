import { describe, expect, it } from 'vitest';
import type { GraphTarget } from './canvas/graphTargets';
import { isSelected, leadOf, NOTHING_SELECTED, selectedOnClick, selectedOnContextClick, selectedOnGesture, selectionFor, selectionHighlights, severalSelected } from './graphSelection';
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

const changeset = (id: number): GraphTarget => ({ kind: 'changeset', id });
const branch = (name: string): GraphTarget => ({ kind: 'branch', lane: layout.lanesByBranch.get(name)! });
const labelOn = (name: string, id: number): GraphTarget => ({ kind: 'label', label: { ...label, name, changeset: id }, more: [] });
const mergeLink: GraphTarget = { kind: 'mergeLink', link: { type: 'merge', sourceChangeset: 5, destinationChangeset: 6 } };

describe('selectedOnClick', () => {
  it('selects what a click lands on, alone, even inside a selection of several', () => {
    const several = selectedOnClick([{ kind: 'changeset', id: 3 }], changeset(4), true);
    expect(selectedOnClick(several, changeset(5), false)).toEqual([{ kind: 'changeset', id: 5 }]);
    expect(selectedOnClick(several, changeset(4), false)).toEqual([{ kind: 'changeset', id: 4 }]);
  });

  it('adds what Ctrl+click lands on, last as the lead, and takes it out when it was selected', () => {
    let selections = selectedOnClick(NOTHING_SELECTED, changeset(3), true);
    selections = selectedOnClick(selections, changeset(5), true);
    expect(selections).toEqual([{ kind: 'changeset', id: 3 }, { kind: 'changeset', id: 5 }]);
    expect(leadOf(selections)).toEqual({ kind: 'changeset', id: 5 });
    expect(selectedOnClick(selections, changeset(3), true)).toEqual([{ kind: 'changeset', id: 5 }]);
    expect(selectedOnClick([{ kind: 'changeset', id: 5 }], changeset(5), true)).toEqual([]);
  });

  it('selects branches and labels together with their own kind only', () => {
    const branches = selectedOnClick([{ kind: 'branch', name: '/main' }], branch('/main/a'), true);
    expect(branches).toEqual([{ kind: 'branch', name: '/main' }, { kind: 'branch', name: '/main/a' }]);
    const labels = selectedOnClick(selectedOnClick(NOTHING_SELECTED, labelOn('v1', 6), true), labelOn('v2', 4), true);
    expect(labels).toEqual([{ kind: 'changeset', id: 6, label: 'v1' }, { kind: 'changeset', id: 4, label: 'v2' }]);
    // A label and its changeset are two things: a changeset doesn't join labels.
    expect(selectedOnClick(labels, changeset(6), true)).toEqual([{ kind: 'changeset', id: 6 }]);
    expect(selectedOnClick(branches, changeset(4), true)).toEqual([{ kind: 'changeset', id: 4 }]);
  });

  it('selects a merge link or the pending changes alone, with Ctrl too', () => {
    const changesets = [{ kind: 'changeset', id: 3 }, { kind: 'changeset', id: 4 }] as const;
    expect(selectedOnClick(changesets, mergeLink, true)).toEqual([{ kind: 'changeset', id: 6 }]);
    expect(selectedOnClick(changesets, { kind: 'pending' }, true)).toEqual([{ kind: 'pending' }]);
    expect(selectedOnClick([{ kind: 'changeset', id: 6 }], changeset(3), true)).toEqual([{ kind: 'changeset', id: 6 }, { kind: 'changeset', id: 3 }]);
  });

  it('clears the selection on empty space, unless Ctrl is held', () => {
    const changesets = [{ kind: 'changeset', id: 3 }, { kind: 'changeset', id: 4 }] as const;
    expect(selectedOnClick(changesets, null, false)).toEqual([]);
    expect(selectedOnClick(changesets, null, true)).toBe(changesets);
  });
});

describe('selectedOnContextClick', () => {
  const changesets = [{ kind: 'changeset', id: 3 }, { kind: 'changeset', id: 4 }] as const;

  it('keeps the selection when the right-click is on something in it, so the menu is for all of it', () => {
    expect(selectedOnContextClick(changesets, changeset(3), false)).toBe(changesets);
    expect(selectedOnContextClick(changesets, changeset(3), true)).toBe(changesets);
  });

  it('selects anything else first, Ctrl adding it', () => {
    expect(selectedOnContextClick(changesets, changeset(5), false)).toEqual([{ kind: 'changeset', id: 5 }]);
    expect(selectedOnContextClick(changesets, changeset(5), true)).toEqual([...changesets, { kind: 'changeset', id: 5 }]);
  });

  it("selects a merge link alone, even when it goes into a selected changeset", () => {
    const withDestination = [{ kind: 'changeset', id: 3 }, { kind: 'changeset', id: 6 }] as const;
    expect(selectedOnContextClick(withDestination, mergeLink, false)).toEqual([{ kind: 'changeset', id: 6 }]);
  });
});

describe('selectedOnGesture', () => {
  const changesets = [{ kind: 'changeset', id: 3 }, { kind: 'changeset', id: 4 }] as const;

  it('keeps the selection on a right-click inside it, as a click wouldn’t', () => {
    expect(selectedOnGesture(changesets, changeset(3), { toggle: false, context: true })).toBe(changesets);
    expect(selectedOnGesture(changesets, changeset(3), { toggle: false, context: false })).toEqual([{ kind: 'changeset', id: 3 }]);
  });

  it('toggles with Ctrl', () => {
    expect(selectedOnGesture(changesets, changeset(3), { toggle: true, context: false })).toEqual([{ kind: 'changeset', id: 4 }]);
  });
});

describe('isSelected', () => {
  it('tells a label from its changeset', () => {
    expect(isSelected([{ kind: 'changeset', id: 6, label: 'v1' }], labelOn('v1', 6))).toBe(true);
    expect(isSelected([{ kind: 'changeset', id: 6, label: 'v1' }], changeset(6))).toBe(false);
    expect(isSelected([{ kind: 'changeset', id: 6 }], null)).toBe(false);
  });
});

describe('selectionHighlights', () => {
  it('draws one selection in the selection color, led by it', () => {
    expect(selectionHighlights([{ kind: 'branch', name: '/main' }])).toEqual({
      selectedChangeset: null,
      selectedBranch: '/main',
      selectedPending: false,
      selectedChangesets: new Set(),
      selectedBranches: new Set(['/main']),
      multipleSelection: false,
    });
    expect(selectionHighlights([{ kind: 'pending' }]).selectedPending).toBe(true);
    expect(selectionHighlights(NOTHING_SELECTED).multipleSelection).toBe(false);
  });

  it("draws several in the multiple selection's color, labels by their changesets, led by the last picked", () => {
    expect(selectionHighlights([{ kind: 'changeset', id: 6, label: 'v1' }, { kind: 'changeset', id: 4, label: 'v2' }])).toEqual({
      selectedChangeset: 4,
      selectedBranch: null,
      selectedPending: false,
      selectedChangesets: new Set([6, 4]),
      selectedBranches: new Set(),
      multipleSelection: true,
    });
  });
});

describe('severalSelected says what a selection of several is', () => {
  it('counts them with their kind', () => {
    expect(severalSelected([{ kind: 'branch', name: '/main' }, { kind: 'branch', name: '/main/a' }, { kind: 'branch', name: '/main/b' }])).toBe('3 branches selected');
    expect(severalSelected([{ kind: 'changeset', id: 1 }, { kind: 'changeset', id: 2 }])).toBe('2 changesets selected');
    expect(severalSelected([{ kind: 'changeset', id: 1, label: 'v0' }, { kind: 'changeset', id: 2, label: 'v1' }])).toBe('2 labels selected');
  });

  it('is null for one or none, which the details show as themselves', () => {
    expect(severalSelected(NOTHING_SELECTED)).toBeNull();
    expect(severalSelected([{ kind: 'branch', name: '/main' }])).toBeNull();
  });
});
