import '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { workspacePlace } from '@shared/domain/place';
import type { MenuEntry } from '../../lib/actions';
import { graphMenu } from './graphMenu';
import type { GraphSelections } from './graphSelection';
import type { BranchPins } from './model/branchRows';
import { sampleHistory } from './model/graphFixtures';
import { layoutGraph } from './model/layoutGraph';

const history = sampleHistory();
const layout = layoutGraph(history);
const laneA = layout.lanesByBranch.get('/main/a')!;
const v1 = history.labels[0]!;

function entryWithId(entries: MenuEntry[], id: string): MenuEntry | undefined {
  return entries.find((entry) => typeof entry === 'object' && entry !== null && 'id' in entry && entry.id === id);
}

function contextWith(selections: GraphSelections) {
  return {
    place: workspacePlace('/work/game'),
    layout,
    currentBranch: '/main',
    loadedChangeset: 6,
    repository: 'game@local',
    goToChangeset: () => {},
    showRelatedTo: () => {},
    revealCreatedBranch: () => {},
    selections,
    positions: null,
  };
}

function labelsOf(menu: MenuEntry[]): string[] {
  return menu.flatMap((entry) => (typeof entry === 'object' && 'label' in entry && typeof entry.label === 'string' ? [entry.label] : []));
}

describe('graphMenu for several selected', () => {
  it('offers the diff of two changesets, not the graph’s ways around one', () => {
    const labels = labelsOf(graphMenu({ kind: 'changeset', id: 5 }, contextWith([{ kind: 'changeset', id: 2 }, { kind: 'changeset', id: 5 }])));
    expect(labels).toContain('Open diff of changesets 2 and 5');
    expect(labels).not.toContain('Go to parent changeset');
  });

  it('has nothing for three changesets, as the lists have', () => {
    const three: GraphSelections = [{ kind: 'changeset', id: 2 }, { kind: 'changeset', id: 4 }, { kind: 'changeset', id: 5 }];
    expect(graphMenu({ kind: 'changeset', id: 4 }, contextWith(three))).toEqual([]);
  });

  it('hides or deletes every branch selected', () => {
    const labels = labelsOf(graphMenu({ kind: 'branch', lane: laneA }, contextWith([{ kind: 'branch', name: '/main/b' }, { kind: 'branch', name: '/main/a' }])));
    expect(labels).toEqual(expect.arrayContaining(['Hide 2 branches', 'Delete 2 branches…']));
    expect(labels).not.toContain('Switch to this branch');
  });

  it('moves every branch selected together from Position', () => {
    // The sample's branches share one id, and pins are kept by id: these get their own.
    const numberedHistory = { ...history, branches: history.branches.map((each, index) => ({ ...each, id: index + 1 })) };
    const numbered = layoutGraph(numberedHistory);
    const saved: BranchPins[] = [];
    const context = {
      ...contextWith([{ kind: 'branch', name: '/main/b' }, { kind: 'branch', name: '/main/a' }]),
      layout: numbered,
      positions: { pins: [], setPins: (pins: BranchPins) => saved.push(pins) },
    };
    const position = entryWithId(graphMenu({ kind: 'branch', lane: numbered.lanesByBranch.get('/main/a')! }, context), 'position') as { entries: MenuEntry[] };
    (entryWithId(position.entries, 'position.top') as { run: () => void }).run();
    expect(saved).toHaveLength(1);
    const after = layoutGraph(numberedHistory, undefined, null, saved[0]);
    const row = (name: string) => after.lanesByBranch.get(name)!.row;
    // Both above /main, which was alone at the top.
    expect(Math.max(row('/main/a'), row('/main/b'))).toBeLessThan(row('/main'));
  });

  it('is the menu of the one right-clicked when it isn’t in the selection', () => {
    const elsewhere = graphMenu({ kind: 'branch', lane: laneA }, contextWith([{ kind: 'branch', name: '/main' }, { kind: 'branch', name: '/main/b' }]));
    expect(labelsOf(elsewhere)).toEqual(labelsOf(graphMenu({ kind: 'branch', lane: laneA }, contextWith([]))));
  });

  it('builds the labels’ menu from every label selected', () => {
    const second = { ...v1, name: 'v0', changeset: 3 };
    const twoLabels = layoutGraph({ ...history, labels: [v1, second] });
    const menu = graphMenu(
      { kind: 'label', label: v1, more: [] },
      { ...contextWith([{ kind: 'changeset', id: 3, label: 'v0' }, { kind: 'changeset', id: 6, label: 'v1' }]), layout: twoLabels },
    );
    expect(labelsOf(menu)).toContain('Delete 2 labels…');
    expect(labelsOf(menu)).not.toContain('Switch to this label');
  });
});
