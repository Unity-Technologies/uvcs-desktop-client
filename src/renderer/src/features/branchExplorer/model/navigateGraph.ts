import type { GraphLayout, NodeLayout } from './layoutGraph';

export type GraphDirection = 'left' | 'right' | 'up' | 'down';

/**
 * The changeset to move to with the arrow keys: left follows the parent, right the next changeset
 * on the same branch (or where it was merged), up and down jump to the closest changeset on the nearest row.
 */
export function neighborChangeset(layout: GraphLayout, fromId: number, direction: GraphDirection): number | null {
  const from = layout.nodes.get(fromId);
  if (!from) return null;

  switch (direction) {
    case 'left':
      return layout.nodes.has(from.changeset.parent) ? from.changeset.parent : null;
    case 'right':
      return nextOnBranch(layout, from) ?? mergeDestination(layout, fromId);
    case 'up':
      return closestOnRow(layout, from, -1);
    case 'down':
      return closestOnRow(layout, from, 1);
  }
}

function nextOnBranch(layout: GraphLayout, from: NodeLayout): number | null {
  for (let column = from.column + 1; column < layout.columnCount; column++) {
    const node = layout.nodesByColumn[column]!;
    if (node.changeset.branch === from.changeset.branch) return node.changeset.id;
  }
  return null;
}

function mergeDestination(layout: GraphLayout, fromId: number): number | null {
  return layout.mergeLinks.find((link) => link.sourceChangeset === fromId)?.destinationChangeset ?? null;
}

function closestOnRow(layout: GraphLayout, from: NodeLayout, step: 1 | -1): number | null {
  for (let row = from.row + step; row >= 0 && row < layout.rowCount; row += step) {
    let closest: NodeLayout | null = null;
    for (const node of layout.nodesByColumn) {
      if (node.row !== row) continue;
      if (!closest || Math.abs(node.column - from.column) < Math.abs(closest.column - from.column)) closest = node;
    }
    if (closest) return closest.changeset.id;
  }
  return null;
}

/**
 * Where the arrow keys start when no changeset is selected: a selected branch's latest changeset on screen,
 * otherwise the workspace changeset, otherwise the latest changeset.
 */
export function startingChangeset(layout: GraphLayout, selectedBranch: string | null, homeChangeset: number | null): number | null {
  if (selectedBranch !== null) {
    const latestOnBranch = layout.nodesByColumn.findLast((node) => node.changeset.branch === selectedBranch);
    if (latestOnBranch) return latestOnBranch.changeset.id;
  }
  if (homeChangeset !== null && layout.nodes.has(homeChangeset)) return homeChangeset;
  return layout.nodesByColumn.at(-1)?.changeset.id ?? null;
}
