import { describe, expect, it } from 'vitest';
import { ACTIONS_BUTTON_RADIUS, actionsMenuPoint, branchActionsCenter, branchesWithActions, changesetActionsCenter, changesetWithActions } from './actionsButton';
import { COLUMN_WIDTH, NODE_RADIUS } from './geometry';

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
    expect(changesetWithActions({ selectedChangeset: 4 })).toBe(4);
    expect(changesetWithActions({ selectedChangeset: null })).toBeNull();
  });
});

describe('where a "More actions" button goes', () => {
  it('sits just past a header card, centered on it, so it never covers the name or comment', () => {
    const card = { x: 100, y: 40, width: 120, height: 36 };
    const center = branchActionsCenter(card);
    expect(center.y).toBe(58);
    expect(center.x - ACTIONS_BUTTON_RADIUS).toBeGreaterThan(card.x + card.width);
  });

  it('sits beside a changeset, clear of its selection halo and of the next column', () => {
    const center = changesetActionsCenter({ x: 500, y: 200 });
    const selectionHalo = NODE_RADIUS + 8;
    expect(center.y).toBe(200);
    expect(center.x - ACTIONS_BUTTON_RADIUS).toBeGreaterThan(500 + selectionHalo);
    expect(center.x + ACTIONS_BUTTON_RADIUS).toBeLessThan(500 + COLUMN_WIDTH - NODE_RADIUS);
  });

  it('opens its menu under it, from its left edge, wherever the graph is zoomed and panned', () => {
    expect(actionsMenuPoint({ x: 100, y: 40, height: 18 }, { zoom: 2, panX: -50, panY: 10 })).toEqual({ x: 150, y: 126 });
  });
});
