import type { GraphLayout, NodeLayout } from './layoutGraph';

export type GraphDirection = 'left' | 'right' | 'up' | 'down';

/** Where the arrow keys stop: a changeset, or the pending changes past the workspace's branch. */
export type GraphStop = { kind: 'changeset'; id: number } | { kind: 'pending' };

/**
 * The stop to move to with the arrow keys, the pending changes being the next changeset of their branch: right from
 * the branch's newest reaches them, left from them goes to the loaded changeset, and up and down weigh them like any
 * changeset on their row.
 */
export function neighborStop(layout: GraphLayout, from: GraphStop, direction: GraphDirection): GraphStop | null {
  const { pending } = layout;
  const place = from.kind === 'pending' ? pending : layout.nodes.get(from.id);
  if (!place) return null;
  if (direction === 'up' || direction === 'down') return closestOnRow(layout, place, direction === 'up' ? -1 : 1);
  if (from.kind === 'pending') return direction === 'left' && layout.nodes.has(pending!.parent) ? changesetStop(pending!.parent) : null;
  const node = place as NodeLayout;
  if (direction === 'right' && pending && node.changeset.branch === pending.branch && nextOnBranch(layout, node) === null) return { kind: 'pending' };
  const id = sideways(layout, node, direction);
  return id === null ? null : changesetStop(id);
}

function changesetStop(id: number): GraphStop {
  return { kind: 'changeset', id };
}

/** The changeset left (its parent) or right (the next on its branch, or where it was merged) of a changeset. */
function sideways(layout: GraphLayout, from: NodeLayout, direction: 'left' | 'right'): number | null {
  switch (direction) {
    case 'left':
      return layout.nodes.has(from.changeset.parent) ? from.changeset.parent : null;
    case 'right':
      return nextOnBranch(layout, from) ?? mergeDestination(layout, from.changeset.id);
  }
}

function nextOnBranch(layout: GraphLayout, from: NodeLayout): number | null {
  for (let column = from.column + 1; column < layout.columnCount; column++) {
    const node = layout.nodesByColumn[column]!;
    if (node.changeset.branch === from.changeset.branch) return node.changeset.id;
  }
  return null;
}

/** The stop closest to a place on the nearest row up or down that has one. */
function closestOnRow(layout: GraphLayout, from: { row: number; column: number }, step: 1 | -1): GraphStop | null {
  const { pending } = layout;
  for (let row = from.row + step; row >= 0 && row < layout.rowCount; row += step) {
    let closest: { column: number; stop: GraphStop } | null = pending?.row === row ? { column: pending.column, stop: { kind: 'pending' } } : null;
    for (const node of layout.nodesByColumn) {
      if (node.row !== row) continue;
      if (!closest || Math.abs(node.column - from.column) < Math.abs(closest.column - from.column)) closest = { column: node.column, stop: changesetStop(node.changeset.id) };
    }
    if (closest) return closest.stop;
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
