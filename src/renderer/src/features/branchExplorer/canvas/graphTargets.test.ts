import { describe, expect, it } from 'vitest';
import type { CodeReview } from '@shared/domain/codeReview';
import { sampleHistory } from '../model/graphFixtures';
import { layoutGraph } from '../model/layoutGraph';
import { COLUMN_WIDTH, columnX, headerTop } from './geometry';
import type { DrawnTargets } from './drawContext';
import { DrawnBoxes } from './drawnBoxes';
import { hitTest, hoverCardFor, nodePoint } from './graphTargets';
import { labelChips } from './labelPlacement';
import { laneShape } from './laneShape';

const layout = layoutGraph(sampleHistory());

function drawnTargets(): DrawnTargets {
  return { reviewChips: new DrawnBoxes(), branchHeaders: new DrawnBoxes(), cutBranchComments: new DrawnBoxes(), captions: new DrawnBoxes() };
}

describe('hitTest', () => {
  it('finds a changeset under the pointer', () => {
    expect(hitTest(layout, nodePoint(layout, 4)!)).toEqual({ kind: 'changeset', id: 4 });
  });

  it('finds a label tag above its changeset', () => {
    const node = layout.nodes.get(6)!;
    const target = hitTest(layout, { x: columnX(node.column), y: labelChips(layout, node)[0]!.top + 5 });
    expect(target).toMatchObject({ kind: 'label', label: { name: 'v1' }, more: [] });
  });

  it('finds a long label over the columns next to its changeset', () => {
    const labels = [{ name: 'release-candidate-2026-09-long', changeset: 6, owner: '', date: '', comment: '' }];
    const labeled = layoutGraph({ ...sampleHistory(), labels });
    const node = labeled.nodes.get(6)!;
    const target = hitTest(labeled, { x: columnX(node.column) - 1.4 * COLUMN_WIDTH, y: labelChips(labeled, node)[0]!.top + 5 });
    expect(target).toMatchObject({ kind: 'label', label: { name: 'release-candidate-2026-09-long' } });
  });

  it('finds a chip counting the labels that did not fit, with them', () => {
    const labels = ['v2.1', 'v2', 'rc'].map((name) => ({ name, changeset: 2, owner: '', date: '', comment: '' }));
    const labeled = layoutGraph({ ...sampleHistory(), labels });
    const node = labeled.nodes.get(2)!;
    const [chip] = labelChips(labeled, node);
    const target = hitTest(labeled, { x: columnX(node.column), y: chip!.top + 5 });
    expect(target).toMatchObject({ kind: 'label', label: { name: 'v2.1' }, more: [{ name: 'v2' }, { name: 'rc' }] });
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

  it('shows the whole comment in a plain tooltip only on a header comment line that does not show all of it', () => {
    const lane = layout.lanesByBranch.get('/main/a')!;
    const shape = laneShape(lane);
    const top = headerTop(shape.y, 36);
    const onComment = { x: shape.left + 20, y: top + 26 };
    const whole = drawnTargets();
    whole.branchHeaders.add(lane, shape.left, top, 120, 36);
    expect(cardAt(onComment, whole)).toBeNull();

    const cut = drawnTargets();
    cut.branchHeaders.add(lane, shape.left, top, 120, 36);
    cut.cutBranchComments.add(lane, shape.left + 8, top + 18, 100, 18);
    expect(cardAt(onComment, cut)).toEqual({ kind: 'clippedText', key: '/main/a', text: lane.branch.comment.trim() });
  });

  it('shows no tooltip on the name line or the band of a header whose comment is cut', () => {
    const lane = layout.lanesByBranch.get('/main/a')!;
    const shape = laneShape(lane);
    const top = headerTop(shape.y, 36);
    const drawn = drawnTargets();
    drawn.branchHeaders.add(lane, shape.left, top, 120, 36);
    drawn.cutBranchComments.add(lane, shape.left + 8, top + 18, 100, 18);
    expect(cardAt({ x: shape.left + 20, y: top + 8 }, drawn)).toBeNull();
    expect(cardAt({ x: shape.left + 115, y: top + 26 }, drawn)).toBeNull();
    const a = nodePoint(layout, 2)!;
    const b = nodePoint(layout, 4)!;
    expect(cardAt({ x: (a.x + b.x) / 2, y: a.y }, drawn)).toBeNull();
  });

  it('opens a card by the pointer for labels', () => {
    const node = layout.nodes.get(6)!;
    expect(cardAt({ x: columnX(node.column), y: labelChips(layout, node)[0]!.top + 5 })).toMatchObject({ kind: 'pointer', target: { kind: 'label' } });
  });

  it('has no card on empty space', () => {
    expect(cardAt({ x: -500, y: -500 })).toBeNull();
  });
});
