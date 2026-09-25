import { describe, expect, it } from 'vitest';
import type { CodeReview } from '@shared/domain/codeReview';
import { sampleHistory } from '../model/graphFixtures';
import { layoutGraph } from '../model/layoutGraph';
import { columnX, headerTop } from './geometry';
import type { DrawnTargets } from './drawContext';
import { DrawnBoxes } from './drawnBoxes';
import { hitTest, hoverCardFor, nodePoint } from './graphTargets';
import { labelTop } from './labelPlacement';
import { laneShape } from './laneShape';

const layout = layoutGraph(sampleHistory());

function drawnTargets(): DrawnTargets {
  return { reviewChips: new DrawnBoxes(), branchHeaders: new DrawnBoxes(), captions: new DrawnBoxes() };
}

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

  it('finds a branch from its header card where it was drawn, pinned to the edge or not', () => {
    const lane = layout.lanesByBranch.get('/main/a')!;
    const shape = laneShape(lane);
    const drawn = drawnTargets();
    drawn.branchHeaders.add(lane, shape.left + 300, headerTop(shape.y), 120, 22);
    expect(hitTest(layout, { x: shape.left + 310, y: headerTop(shape.y) + 5 }, drawn)).toMatchObject({ kind: 'branch', lane: { branch: { name: '/main/a' } } });
    expect(hitTest(layout, { x: shape.left + 10, y: headerTop(shape.y) + 5 }, drawn)).toBeNull();
  });

  it('finds a changeset from its comment', () => {
    const node = layout.nodes.get(4)!;
    const drawn = drawnTargets();
    drawn.captions.add(node, columnX(node.column) - 20, 500, 80, 14);
    expect(hitTest(layout, { x: columnX(node.column) + 40, y: 505 }, drawn)).toEqual({ kind: 'changeset', id: 4 });
  });

  it('opens a code review from its chip on click only', () => {
    const lane = layout.lanesByBranch.get('/main/a')!;
    const review = { id: 7 } as CodeReview;
    const drawn = drawnTargets();
    drawn.branchHeaders.add(lane, 0, 0, 200, 22);
    drawn.reviewChips.add(review, 100, 3, 50, 15);
    expect(hitTest(layout, { x: 110, y: 10 }, drawn)).toEqual({ kind: 'codeReview', review });
    expect(hitTest(layout, { x: 110, y: 10 }, drawn, { chips: false })).toMatchObject({ kind: 'branch' });
  });

  it('returns null on empty space', () => {
    expect(hitTest(layout, { x: -500, y: -500 })).toBeNull();
  });
});

describe('hoverCardFor', () => {
  const cardAt = (point: { x: number; y: number }, drawn: DrawnTargets | null = null) => hoverCardFor(hitTest(layout, point, drawn), point, drawn);

  function withCaption(id: number): { drawn: DrawnTargets; caption: { x: number; y: number } } {
    const node = layout.nodes.get(id)!;
    const drawn = drawnTargets();
    const top = nodePoint(layout, id)!.y + 30;
    drawn.captions.add(node, columnX(node.column) - 20, top, 80, 14);
    return { drawn, caption: { x: columnX(node.column) + 40, y: top + 7 } };
  }

  it('opens one card over the caption from the changeset and from its caption alike', () => {
    const { drawn, caption } = withCaption(4);
    const fromNode = cardAt(nodePoint(layout, 4)!, drawn);
    const fromCaption = cardAt(caption, drawn);
    expect(fromNode).toMatchObject({ kind: 'caption', target: { kind: 'changeset', id: 4 }, caption: { y: caption.y - 7 } });
    expect(fromCaption).toEqual(fromNode);
  });

  it('opens a changeset card by the pointer when its caption is not drawn (zoomed out, comments hidden)', () => {
    expect(cardAt(nodePoint(layout, 4)!)).toEqual({ kind: 'pointer', target: { kind: 'changeset', id: 4 } });
  });

  it('has no card for a branch band: its header already names it', () => {
    const a = nodePoint(layout, 2)!;
    const b = nodePoint(layout, 4)!;
    const between = { x: (a.x + b.x) / 2, y: a.y };
    expect(hitTest(layout, between)).toMatchObject({ kind: 'branch' });
    expect(cardAt(between)).toBeNull();
  });

  it('unfolds a branch header only when its name or comment was cut', () => {
    const lane = layout.lanesByBranch.get('/main/a')!;
    const shape = laneShape(lane);
    const onHeader = { x: shape.left + 10, y: headerTop(shape.y) + 5 };
    const whole = drawnTargets();
    whole.branchHeaders.add(lane, shape.left, headerTop(shape.y), 120, 22);
    expect(cardAt(onHeader, whole)).toBeNull();

    const cut = drawnTargets();
    cut.branchHeaders.add(lane, shape.left, headerTop(shape.y), 120, 22, true);
    expect(cardAt(onHeader, cut)).toMatchObject({ kind: 'header', target: { lane: { branch: { name: '/main/a' } } } });
  });

  it('never unfolds a cut header from its band', () => {
    const lane = layout.lanesByBranch.get('/main/a')!;
    const shape = laneShape(lane);
    const drawn = drawnTargets();
    drawn.branchHeaders.add(lane, shape.left, headerTop(shape.y), 120, 22, true);
    const a = nodePoint(layout, 2)!;
    const b = nodePoint(layout, 4)!;
    expect(cardAt({ x: (a.x + b.x) / 2, y: a.y }, drawn)).toBeNull();
  });

  it('opens a card by the pointer for labels', () => {
    const node = layout.nodes.get(6)!;
    expect(cardAt({ x: columnX(node.column), y: labelTop(layout, node, 0) + 5 })).toMatchObject({ kind: 'pointer', target: { kind: 'label' } });
  });

  it('has no card on empty space', () => {
    expect(cardAt({ x: -500, y: -500 })).toBeNull();
  });
});
