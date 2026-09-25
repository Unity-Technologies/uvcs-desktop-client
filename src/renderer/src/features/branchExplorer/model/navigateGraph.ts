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

/** The oldest or newest changeset of a branch on screen, or where it starts from when none of its own is shown. */
export function branchEnd(layout: GraphLayout, branch: string, edge: 'first' | 'last'): number | null {
  const own = layout.nodesByColumn.filter((node) => node.changeset.branch === branch);
  const end = edge === 'first' ? own[0] : own.at(-1);
  if (end) return end.changeset.id;
  return branchBase(layout, branch);
}

/** The oldest or newest changeset of the whole graph. */
export function graphEnd(layout: GraphLayout, edge: 'first' | 'last'): number | null {
  const end = edge === 'first' ? layout.nodesByColumn[0] : layout.nodesByColumn.at(-1);
  return end?.changeset.id ?? null;
}

/**
 * A page of `columns` older or newer: the farthest changeset of the same branch within the page, and once the branch
 * has nothing further that way, whichever changeset is a page away, so paging keeps moving through time.
 */
export function pageChangeset(layout: GraphLayout, fromId: number, step: 1 | -1, columns: number): number | null {
  const from = layout.nodes.get(fromId);
  if (!from) return null;
  const target = Math.min(layout.columnCount - 1, Math.max(0, from.column + step * Math.max(1, Math.round(columns))));
  if (target === from.column) return null;

  let onBranch: NodeLayout | null = null;
  for (let column = from.column + step; column !== target + step; column += step) {
    const node = layout.nodesByColumn[column]!;
    if (node.changeset.branch === from.changeset.branch) onBranch = node;
  }
  return (onBranch ?? layout.nodesByColumn[target]!).changeset.id;
}

/** Where a merge into this changeset came from; the latest source when several were merged in. */
export function mergeSource(layout: GraphLayout, id: number): number | null {
  return linkedChangeset(layout, id, 'source');
}

/** Where this changeset was merged to; the earliest destination when it was merged more than once. */
export function mergeDestination(layout: GraphLayout, id: number): number | null {
  return linkedChangeset(layout, id, 'destination');
}

function linkedChangeset(layout: GraphLayout, id: number, end: 'source' | 'destination'): number | null {
  const node = layout.nodes.get(id);
  if (!node) return null;
  let best: NodeLayout | null = null;
  for (const link of layout.mergeLinks) {
    const [here, there] = end === 'source' ? [link.destinationChangeset, link.sourceChangeset] : [link.sourceChangeset, link.destinationChangeset];
    if (layout.nodes.get(here) !== node) continue;
    const other = layout.nodes.get(there);
    if (!other || other === node) continue;
    if (!best || (end === 'source' ? other.column > best.column : other.column < best.column)) best = other;
  }
  return best?.changeset.id ?? null;
}

/** The changeset a branch starts from, on its parent branch, when it is on screen. */
export function branchBase(layout: GraphLayout, branch: string): number | null {
  return layout.lanesByBranch.get(branch)?.baseChangeset ?? null;
}
