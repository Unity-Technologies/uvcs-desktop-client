import { describe, expect, it } from 'vitest';
import { sampleHistory } from '../model/graphFixtures';
import { layoutGraph } from '../model/layoutGraph';
import { nodePoint, pendingPoint } from './geometry';
import { laneHeaderTop } from './laneShape';
import { menuPoint, selectionPoint } from './selectionPoint';

describe('selectionPoint', () => {
  const layout = layoutGraph(sampleHistory(), undefined, { branch: '/main/a', parent: 5, mergeLinks: [] });

  it('finds changesets and the pending changes where they are drawn, and a branch at its header', () => {
    expect(selectionPoint(layout, { kind: 'changeset', id: 4 })).toEqual(nodePoint(layout, 4));
    expect(selectionPoint(layout, { kind: 'pending' })).toEqual(pendingPoint(layout));
    expect(selectionPoint(layout, { kind: 'branch', name: '/main/b' })?.y).toBe(laneHeaderTop(layout.lanesByBranch.get('/main/b')!));
    expect(selectionPoint(layoutGraph(sampleHistory()), { kind: 'pending' })).toBeNull();
    expect(selectionPoint(layout, { kind: 'branch', name: '/gone' })).toBeNull();
  });
});

describe('menuPoint', () => {
  const layout = layoutGraph(sampleHistory());

  it('opens a changeset’s and a label’s menu at the node, a branch’s at its header', () => {
    const lane = layout.lanesByBranch.get('/main/b')!;
    const label = sampleHistory().labels[0]!;
    expect(menuPoint(layout, { kind: 'changeset', id: 4 })).toEqual(nodePoint(layout, 4));
    expect(menuPoint(layout, { kind: 'label', label, more: [] })).toEqual(nodePoint(layout, label.changeset));
    expect(menuPoint(layout, { kind: 'branch', lane })).toEqual(selectionPoint(layout, { kind: 'branch', name: '/main/b' }));
    expect(menuPoint(layout, { kind: 'pending' })).toBeNull();
  });
});
