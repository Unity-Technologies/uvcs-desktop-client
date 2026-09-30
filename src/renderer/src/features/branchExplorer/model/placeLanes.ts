import { groupBy } from './groupBy';
import type { Lane } from './layoutGraph';

/** Free columns kept between two lanes sharing a row, so they never look connected. */
const LANE_GAP = 3;

/** A lane before it has a row. */
export type UnplacedLane = Omit<Lane, 'row'>;

/**
 * Assigns rows: parents before children, each lane in the first free row below its parent, packed into shared rows
 * when they don't overlap. `/main` (or whichever top-level branch comes first) takes the top row.
 */
export function placeLanes(unplaced: UnplacedLane[]): Lane[] {
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
