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
