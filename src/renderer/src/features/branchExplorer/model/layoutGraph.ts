import type { BranchExplorerData, GraphBranch, GraphChangeset, GraphLabel, MergeLink } from '@shared/domain/branchExplorer';

export interface NodeLayout {
  changeset: GraphChangeset;
  column: number;
  row: number;
}

/** A branch drawn as a horizontal lane. */
export interface Lane {
  branch: GraphBranch;
  row: number;
  startColumn: number;
  endColumn: number;
  /** The changeset the branch starts from, when it is visible (it lives on another lane). */
  baseChangeset: number | null;
}

export interface GraphLayout {
  nodes: ReadonlyMap<number, NodeLayout>;
  /** Every changeset has its own column, so a column identifies at most one node. */
  nodesByColumn: readonly NodeLayout[];
  lanes: readonly Lane[];
  lanesByBranch: ReadonlyMap<string, Lane>;
  lanesByRow: ReadonlyMap<number, readonly Lane[]>;
  mergeLinks: readonly MergeLink[];
  labelsByChangeset: ReadonlyMap<number, readonly GraphLabel[]>;
  columnCount: number;
  rowCount: number;
}

/** Free columns kept between two lanes sharing a row, so they never look connected. */
const LANE_GAP = 2;

/**
 * Lays out history as lanes: changesets ordered left to right by id (parents always come first),
 * one lane per branch, child branches below their parents, packed into shared rows when they don't overlap.
 */
export function layoutGraph(data: BranchExplorerData): GraphLayout {
  const changesets = [...data.changesets].sort((a, b) => a.id - b.id);
  const columnOf = new Map(changesets.map((changeset, column) => [changeset.id, column]));
  const lanes = placeLanes(buildLanes(data.branches, changesets, columnOf));
  const lanesByBranch = new Map(lanes.map((lane) => [lane.branch.name, lane]));

  const nodesByColumn = changesets.map((changeset, column) => ({
    changeset,
    column,
    row: lanesByBranch.get(changeset.branch)?.row ?? 0,
  }));

  return {
    nodes: new Map(nodesByColumn.map((node) => [node.changeset.id, node])),
    nodesByColumn,
    lanes,
    lanesByBranch,
    lanesByRow: groupBy(lanes, (lane) => lane.row),
    mergeLinks: data.mergeLinks.filter((link) => columnOf.has(link.sourceChangeset) && columnOf.has(link.destinationChangeset)),
    labelsByChangeset: groupBy(
      data.labels.filter((label) => columnOf.has(label.changeset)),
      (label) => label.changeset,
    ),
    columnCount: changesets.length,
    rowCount: Math.max(0, ...lanes.map((lane) => lane.row + 1)),
  };
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

    const ownColumns = own.map((changeset) => columnOf.get(changeset.id)!);
    const isOnOtherBranch = baseColumn !== undefined && !own.some((changeset) => changeset.id === baseChangeset);
    return [
      {
        branch,
        startColumn: Math.min(...ownColumns, baseColumn ?? Number.POSITIVE_INFINITY),
        endColumn: Math.max(...ownColumns, baseColumn ?? Number.NEGATIVE_INFINITY),
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

  const occupiedByRow: [number, number][][] = [];
  const placed: Lane[] = [];

  const place = (lane: UnplacedLane, minimumRow: number): void => {
    let row = minimumRow;
    while (overlaps(occupiedByRow[row], lane)) row++;
    (occupiedByRow[row] ??= []).push([lane.startColumn - LANE_GAP, lane.endColumn + LANE_GAP]);
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

function overlaps(intervals: [number, number][] | undefined, lane: UnplacedLane): boolean {
  return (intervals ?? []).some(([start, end]) => lane.startColumn <= end && lane.endColumn >= start);
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
