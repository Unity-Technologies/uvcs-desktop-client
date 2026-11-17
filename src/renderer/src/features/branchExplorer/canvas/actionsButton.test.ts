import { describe, expect, it } from 'vitest';
import { largeHistory, sampleHistory } from '../model/graphFixtures';
import { layoutGraph, type Lane } from '../model/layoutGraph';
import {
  ACTIONS_BUTTON_RADIUS,
  actionsButtonCenter,
  actionsMenuPoint,
  branchActionsCenter,
  branchActionsHitBox,
  branchesWithActions,
  changesetActionsCenter,
  changesetWithActions,
} from './actionsButton';
import { DrawnBoxes } from './drawnBoxes';
import { COLUMN_WIDTH, NODE_RADIUS, nodePoint } from './geometry';

describe('which objects show a "More actions" button', () => {
  it('shows none for a branch unless it is selected or under the pointer', () => {
    expect(branchesWithActions({ hoveredBranch: null, selectedBranch: null })).toEqual([]);
  });

  it('shows one for the selected branch and one for the branch under the pointer', () => {
    expect(branchesWithActions({ hoveredBranch: '/main/b', selectedBranch: '/main/a' })).toEqual(['/main/a', '/main/b']);
    expect(branchesWithActions({ hoveredBranch: '/main/b', selectedBranch: null })).toEqual(['/main/b']);
  });

  it('shows one button when the branch under the pointer is the selected one', () => {
    expect(branchesWithActions({ hoveredBranch: '/main/a', selectedBranch: '/main/a' })).toEqual(['/main/a']);
  });

  it('shows one for the selected changeset only', () => {
    expect(changesetWithActions({ selectedChangeset: 4, selectedLabel: null })).toBe(4);
    expect(changesetWithActions({ selectedChangeset: null, selectedLabel: null })).toBeNull();
  });

  it('shows none for a selected label: a button there would open its changeset\'s menu, not the label\'s', () => {
    expect(changesetWithActions({ selectedChangeset: 4, selectedLabel: 'v1' })).toBeNull();
  });
});

describe('where a "More actions" button goes', () => {
  const card = { x: 100, y: 40, width: 120, height: 36 };

  it('sits just past a header card, centered on it, so it never covers the name or comment', () => {
    const center = branchActionsCenter(card);
    expect(center.y).toBe(58);
    expect(center.x - ACTIONS_BUTTON_RADIUS).toBeGreaterThan(card.x + card.width);
  });

  it('is found by the pointer from the card\'s edge to the card\'s bottom, so moving onto it never leaves the branch', () => {
    const center = branchActionsCenter(card);
    const box = branchActionsHitBox(card);
    expect(box.x).toBe(card.x + card.width);
    expect(box.x + box.width).toBe(center.x + ACTIONS_BUTTON_RADIUS);
    expect(box.y).toBe(center.y - ACTIONS_BUTTON_RADIUS);
    expect(box.y + box.height).toBe(Math.max(center.y + ACTIONS_BUTTON_RADIUS, card.y + card.height));
  });

  it('sits beside a changeset, clear of its selection halo and of the next column', () => {
    const center = changesetActionsCenter({ x: 500, y: 200 });
    const selectionHalo = NODE_RADIUS + 8;
    expect(center.y).toBe(200);
    expect(center.x - ACTIONS_BUTTON_RADIUS).toBeGreaterThan(500 + selectionHalo);
    expect(center.x + ACTIONS_BUTTON_RADIUS).toBeLessThan(500 + COLUMN_WIDTH - NODE_RADIUS);
  });

  it('opens its menu under it, from its left edge', () => {
    expect(actionsMenuPoint({ x: 100, y: 50 })).toEqual({ x: 100 - ACTIONS_BUTTON_RADIUS, y: 50 + ACTIONS_BUTTON_RADIUS });
  });
});

describe('where a subject\'s button is this frame', () => {
  const layout = layoutGraph(sampleHistory());

  it('is beside its branch\'s card where it was drawn, and nowhere when the card wasn\'t', () => {
    const lane = layout.lanesByBranch.get('/main/a')!;
    const drawn = { branchHeaders: new DrawnBoxes<Lane>() };
    expect(actionsButtonCenter({ kind: 'branch', lane }, layout, drawn)).toBeNull();
    drawn.branchHeaders.add(lane, 100, 40, 120, 36);
    expect(actionsButtonCenter({ kind: 'branch', lane }, layout, drawn)).toEqual(branchActionsCenter({ x: 100, y: 40, width: 120, height: 36 }));
  });

  it('is beside its changeset, and nowhere for one not laid out or collapsed into "+N"', () => {
    const drawn = { branchHeaders: new DrawnBoxes<Lane>() };
    expect(actionsButtonCenter({ kind: 'changeset', id: 4 }, layout, drawn)).toEqual(changesetActionsCenter(nodePoint(layout, 4)!));
    expect(actionsButtonCenter({ kind: 'changeset', id: 999 }, layout, drawn)).toBeNull();
    const collapsedLayout = layoutGraph(largeHistory(300, 60), { keep: new Set([40]) });
    const collapsed = collapsedLayout.nodesByColumn.find((node) => node.collapsed !== null)!;
    expect(actionsButtonCenter({ kind: 'changeset', id: collapsed.changeset.id }, collapsedLayout, drawn)).toBeNull();
  });
});
