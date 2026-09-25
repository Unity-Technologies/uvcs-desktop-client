import { describe, expect, it } from 'vitest';
import { sampleHistory } from '../model/graphFixtures';
import { layoutGraph } from '../model/layoutGraph';
import { columnX, headerTop } from './geometry';
import { hitTest, nodePoint } from './graphTargets';
import { labelTop } from './labelPlacement';
import { laneShape } from './laneShape';

const layout = layoutGraph(sampleHistory());

describe('hitTest', () => {
  it('finds a changeset under the pointer', () => {
    expect(hitTest(layout, nodePoint(layout, 4)!)).toEqual({ kind: 'changeset', id: 4 });
  });

  it('finds a label tag above its changeset', () => {
    const node = layout.nodes.get(6)!;
    const target = hitTest(layout, { x: columnX(node.column), y: labelTop(layout, node, 0) + 5 });
    expect(target).toMatchObject({ kind: 'label', label: { name: 'v1' } });
  });

  it('finds a merge link along its curve', () => {
    const from = nodePoint(layout, 5)!;
    const to = nodePoint(layout, 6)!;
    const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    expect(hitTest(layout, middle)).toMatchObject({ kind: 'mergeLink' });
  });

  it('finds a branch lane between changesets', () => {
    const a = nodePoint(layout, 2)!;
    const b = nodePoint(layout, 4)!;
    expect(hitTest(layout, { x: (a.x + b.x) / 2, y: a.y })).toMatchObject({ kind: 'branch', lane: { branch: { name: '/main/a' } } });
  });

  it('finds a branch from its header card', () => {
    const shape = laneShape(layout.lanesByBranch.get('/main/a')!);
    expect(hitTest(layout, { x: shape.left + 10, y: headerTop(shape.y) + 5 })).toMatchObject({ kind: 'branch', lane: { branch: { name: '/main/a' } } });
  });

  it('returns null on empty space', () => {
    expect(hitTest(layout, { x: -500, y: -500 })).toBeNull();
  });
});
