import type { GraphLayout, Lane } from './layoutGraph';

/** A branch the user moved: the row it asks for, by its object id (a name changes with a rename). */
export interface BranchPin {
  branch: number;
  row: number;
}

/** The branches moved, the one moved last at the end: where two want the same room, it wins (`placeLanes`). */
export type BranchPins = readonly BranchPin[];

/** The moved branches, by repository: an id names a branch of one repository. */
export type PinsByRepository = Readonly<Record<string, BranchPins>>;

export const NO_PINS: BranchPins = [];

export type BranchMove = 'up' | 'down' | 'top' | 'bottom';

/** Which moves the branch's menu offers, and whether its own position or every position can be reset. */
export type BranchMoves = Record<BranchMove | 'reset' | 'resetAll', boolean>;

/** The repository's moved branches; always the same empty list when it has none, so a store selector stays stable. */
export function pinsOf(pinsByRepository: PinsByRepository, repository: string | undefined): BranchPins {
  return (repository === undefined ? undefined : pinsByRepository[repository]) ?? NO_PINS;
}

/** The positions with the repository's replaced; a repository without any is forgotten. */
export function withPins(pinsByRepository: PinsByRepository, repository: string, pins: BranchPins): PinsByRepository {
  const { [repository]: _replaced, ...others } = pinsByRepository;
  return pins.length === 0 ? others : { ...others, [repository]: pins };
}

/** The positions once the lane's branch moves from the row it is drawn on; `bottom` is below every row. */
export function movedBranch(pins: BranchPins, lane: Lane, move: BranchMove, rowCount: number): BranchPins {
  const row = { up: lane.row - 1, down: lane.row + 1, top: 0, bottom: rowCount }[move];
  return [...withoutPin(pins, lane.branch.id), { branch: lane.branch.id, row }];
}

export function withoutPin(pins: BranchPins, branchId: number): BranchPins {
  return pins.filter((pin) => pin.branch !== branchId);
}

/**
 * A move that would change nothing isn't offered: nothing is above the top row, and a branch alone on the last row is
 * already below every other.
 */
export function branchMoves(layout: GraphLayout, lane: Lane, pins: BranchPins): BranchMoves {
  const isTop = lane.row === 0;
  const isAloneAtBottom = lane.row === layout.rowCount - 1 && (layout.lanesByRow.get(lane.row)?.length ?? 0) === 1;
  return {
    up: !isTop,
    top: !isTop,
    down: !isAloneAtBottom,
    bottom: !isAloneAtBottom,
    reset: pins.some((pin) => pin.branch === lane.branch.id),
    resetAll: pins.length > 0,
  };
}

/**
 * The positions once several lanes make one move, each as it would alone (`movedBranch`). The lowest is moved first,
 * so the top one is placed first (`placeLanes`) and the lanes keep their order. The same pins when none moves.
 */
export function movedBranches(pins: BranchPins, layout: GraphLayout, lanes: readonly Lane[], move: BranchMove): BranchPins {
  const moving = lanesMoving(layout, lanes, pins, move).sort((above, below) => below.row - above.row);
  return moving.reduce((next, lane) => movedBranch(next, lane, move, layout.rowCount), pins);
}

/**
 * Which lanes make the move so that none passes another. To the top or the bottom, all of them once any can: one
 * already there is pinned too, or the others would be placed past it. One row up or down, a lane the move has no room
 * for (`branchMoves`) stays, and so does one whose row would be a staying lane's: they stay stacked as they were.
 */
function lanesMoving(layout: GraphLayout, lanes: readonly Lane[], pins: BranchPins, move: BranchMove): Lane[] {
  const canMove = (lane: Lane) => branchMoves(layout, lane, pins)[move];
  if (move === 'top' || move === 'bottom') return lanes.some(canMove) ? [...lanes] : [];
  const step = move === 'up' ? -1 : 1;
  const stayingRows = new Set<number>();
  return [...lanes]
    .sort((first, second) => (first.row - second.row) * -step)
    .filter((lane) => {
      const moves = canMove(lane) && !stayingRows.has(lane.row + step);
      if (!moves) stayingRows.add(lane.row);
      return moves;
    });
}

/** The moves offered for several branches: each one any of them can make, and their reset once any of them moved. */
export function branchesMoves(layout: GraphLayout, lanes: readonly Lane[], pins: BranchPins): BranchMoves {
  const each = lanes.map((lane) => branchMoves(layout, lane, pins));
  const any = (key: keyof BranchMoves): boolean => each.some((moves) => moves[key]);
  return { up: any('up'), down: any('down'), top: any('top'), bottom: any('bottom'), reset: any('reset'), resetAll: pins.length > 0 };
}
