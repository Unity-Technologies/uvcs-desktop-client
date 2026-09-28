import type { BranchExplorerData, GraphBranch, GraphChangeset, GraphLabel, MergeLink } from '@shared/domain/branchExplorer';
import type { PendingMergeLink } from '@shared/domain/pendingChanges';
import { collapseLinearRuns, structuralChangesets, type ShownChangeset } from './structureOnly';

export interface NodeLayout extends ShownChangeset {
  column: number;
  row: number;
}

/** A branch drawn as a horizontal lane. */
export interface Lane {
  branch: GraphBranch;
  row: number;
  startColumn: number;
  endColumn: number;
  /** Column of the branch's first visible changeset (or of the pending changeset on it); null when there is none. */
  firstOwnColumn: number | null;
  /** The changeset the branch starts from, when it is visible (it lives on another lane). */
  baseChangeset: number | null;
}

/**
 * The workspace's changes not checked in yet, drawn as the changeset they will become (as the official client draws
 * its "checkout changeset"): a child of the loaded changeset on the workspace's branch, newer than everything else.
 */
export interface PendingChangeset {
  branch: string;
  /** The loaded changeset. */
  parent: number;
  /** The merges in progress, drawn into it. */
  mergeLinks: readonly PendingMergeLink[];
}

/** Where the pending changeset is drawn: the column past every changeset, on its branch's row. */
export interface PendingNode extends PendingChangeset {
  column: number;
  row: number;
}

export interface GraphLayout {
  /** The node of every changeset; changesets in a collapsed run all map to the run's node. */
  nodes: ReadonlyMap<number, NodeLayout>;
  /** Every node has its own column, so a column identifies at most one node. */
  nodesByColumn: readonly NodeLayout[];
  lanes: readonly Lane[];
  lanesByBranch: ReadonlyMap<string, Lane>;
  lanesByRow: ReadonlyMap<number, readonly Lane[]>;
  mergeLinks: readonly MergeLink[];
  labelsByChangeset: ReadonlyMap<number, readonly GraphLabel[]>;
  /** The workspace's pending changes, when its loaded changeset and branch are in the graph; its merge links only from changesets in it. */
  pending: PendingNode | null;
  /** The changesets' columns; the pending changeset takes the one after them. */
  columnCount: number;
  rowCount: number;
}

/** Free columns kept between two lanes sharing a row, so they never look connected. */
const LANE_GAP = 3;

/** "Only relevant changesets": everything but the structural changesets and these collapses into "+N" nodes. */
export interface StructureOnly {
  keep: ReadonlySet<number>;
}

/**
 * Lays out history as lanes: changesets ordered left to right by id (parents always come first),
 * one lane per branch, child branches below their parents, packed into shared rows when they don't overlap.
 */
export function layoutGraph(data: BranchExplorerData, structureOnly?: StructureOnly, pending: PendingChangeset | null = null): GraphLayout {
  const sorted = [...data.changesets].sort((a, b) => a.id - b.id);
  const shown = structureOnly
    ? collapseLinearRuns(sorted, new Set([...structuralChangesets(data), ...structureOnly.keep]))
    : sorted.map((changeset) => ({ changeset, collapsed: null }));
  const columnOf = new Map<number, number>();
  shown.forEach(({ changeset, collapsed }, column) => {
    for (const member of collapsed ?? [changeset]) columnOf.set(member.id, column);
  });
  const unplaced = buildLanes(data.branches, shown.map(({ changeset }) => changeset), columnOf);
  const pendingLane = pending && columnOf.has(pending.parent) ? unplaced.find((lane) => lane.branch.name === pending.branch) : undefined;
  // Its branch's band reaches it, before the rows are packed: the band takes that room in its row.
  if (pendingLane) {
    pendingLane.endColumn = shown.length;
    pendingLane.firstOwnColumn ??= shown.length;
  }
  const lanes = placeLanes(unplaced);
  const lanesByBranch = new Map(lanes.map((lane) => [lane.branch.name, lane]));

  const nodesByColumn = shown.map(({ changeset, collapsed }, column): NodeLayout => ({
    changeset,
    collapsed,
    column,
    row: lanesByBranch.get(changeset.branch)?.row ?? 0,
  }));

  const nodes = new Map<number, NodeLayout>();
  for (const node of nodesByColumn) for (const member of node.collapsed ?? [node.changeset]) nodes.set(member.id, node);

  return {
    nodes,
    nodesByColumn,
    lanes,
    lanesByBranch,
    lanesByRow: groupBy(lanes, (lane) => lane.row),
    mergeLinks: data.mergeLinks.filter((link) => columnOf.has(link.sourceChangeset) && columnOf.has(link.destinationChangeset)),
    labelsByChangeset: groupBy(
      data.labels.filter((label) => columnOf.has(label.changeset)),
      (label) => label.changeset,
    ),
    pending:
      pending && pendingLane
        ? {
            ...pending,
            mergeLinks: pending.mergeLinks.filter((link) => columnOf.has(link.sourceChangeset)),
            column: shown.length,
            row: lanesByBranch.get(pending.branch)!.row,
          }
        : null,
    columnCount: shown.length,
    rowCount: lanes.reduce((count, lane) => Math.max(count, lane.row + 1), 0),
  };
}

/**
 * The "only relevant changesets" layout keeping one more changeset (the selection) out of the "+N" nodes. Keeping a
 * changeset that already shows on its own (or isn't in the history) changes nothing, so the layout without it is the
 * one: arrowing along the graph lays nothing out again.
 */
export function layoutKeeping(
  data: BranchExplorerData,
  base: { keep: ReadonlySet<number>; pending: PendingChangeset | null; layout: GraphLayout },
  id: number | null,
): GraphLayout {
  const node = id === null ? undefined : base.layout.nodes.get(id);
  if (!node || node.collapsed === null) return base.layout;
  return layoutGraph(data, { keep: new Set([...base.keep, id!]) }, base.pending);
}

type UnplacedLane = Omit<Lane, 'row'>;

function buildLanes(branches: GraphBranch[], changesets: GraphChangeset[], columnOf: Map<number, number>): UnplacedLane[] {
  const columnsByBranch = groupBy(changesets, (changeset) => changeset.branch);

  return branches.flatMap((branch) => {
    const own = columnsByBranch.get(branch.name) ?? [];
    const first = own[0];
    const baseChangeset = first ? first.parent : branch.headChangeset;
    const baseColumn = columnOf.get(baseChangeset);

    // A branch with no visible changesets and no visible base has nothing to draw.
    if (own.length === 0 && baseColumn === undefined) return [];

    // Changesets come in column order, so a branch's own columns run from its first changeset to its last.
    const firstOwnColumn = first ? columnOf.get(first.id)! : null;
    const lastOwnColumn = first ? columnOf.get(own.at(-1)!.id)! : null;
    const isOnOtherBranch = baseColumn !== undefined && !own.some((changeset) => changeset.id === baseChangeset);
    return [
      {
        branch,
        startColumn: Math.min(firstOwnColumn ?? Number.POSITIVE_INFINITY, baseColumn ?? Number.POSITIVE_INFINITY),
        endColumn: Math.max(lastOwnColumn ?? Number.NEGATIVE_INFINITY, baseColumn ?? Number.NEGATIVE_INFINITY),
        firstOwnColumn,
        baseChangeset: isOnOtherBranch ? baseChangeset : null,
      },
    ];
  });
}

/** Assigns rows: parents before children, each lane in the first free row below its parent. */
function placeLanes(unplaced: UnplacedLane[]): Lane[] {
  const byName = new Map(unplaced.map((lane) => [lane.branch.name, lane]));
  const childrenOf = groupBy(
    unplaced.filter((lane) => byName.has(lane.branch.parent)),
    (lane) => lane.branch.parent,
  );
  const roots = unplaced.filter((lane) => !byName.has(lane.branch.parent)).sort(rootOrder);

  const occupiedByRow: RowOccupancy[] = [];
  const placed: Lane[] = [];

  const place = (lane: UnplacedLane, minimumRow: number): void => {
    let row = minimumRow;
    while (!occupy((occupiedByRow[row] ??= { starts: [], ends: [] }), lane.startColumn, lane.endColumn)) row++;
    placed.push({ ...lane, row });

    const children = [...(childrenOf.get(lane.branch.name) ?? [])].sort((a, b) => a.startColumn - b.startColumn);
    children.forEach((childLane) => place(childLane, row + 1));
  };

  roots.forEach((root, index) => place(root, index === 0 ? 0 : 1));
  return placed;
}

/** `/main` (or whichever top-level branch comes first) takes the top row. */
function rootOrder(a: UnplacedLane, b: UnplacedLane): number {
  const aIsMain = a.branch.name === '/main' ? 0 : 1;
  const bIsMain = b.branch.name === '/main' ? 0 : 1;
  return aIsMain - bIsMain || a.startColumn - b.startColumn;
}

/** The column spans of the lanes in a row, sorted: they never overlap, so their starts and their ends both ascend. */
interface RowOccupancy {
  starts: number[];
  ends: number[];
}

/**
 * Takes the span in the row if it stays `LANE_GAP` columns clear of every lane there. A binary search: a row holds
 * up to thousands of lanes.
 */
function occupy(row: RowOccupancy, start: number, end: number): boolean {
  let low = 0;
  let high = row.ends.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (row.ends[middle]! + LANE_GAP < start) low = middle + 1;
    else high = middle;
  }
  if (low < row.starts.length && row.starts[low]! - LANE_GAP <= end) return false;
  row.starts.splice(low, 0, start);
  row.ends.splice(low, 0, end);
  return true;
}

function groupBy<Item, Key>(items: readonly Item[], keyOf: (item: Item) => Key): Map<Key, Item[]> {
  const groups = new Map<Key, Item[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}
