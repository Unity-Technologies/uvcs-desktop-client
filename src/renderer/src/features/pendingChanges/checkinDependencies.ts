import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { isCheckinCandidate } from './changeCategories';

/**
 * A folder's changes that a change inside it can't go in without: cm refuses it ("depend on others that need to be
 * included", "the change '/lib' must be selected too"). A checkout isn't one: cm takes it along.
 */
const NEEDED_BY_WHAT_IT_HOLDS: ReadonlySet<ChangeKind> = new Set(['private', 'added', 'moved', 'locallyMoved']);
const MOVED: ReadonlySet<ChangeKind> = new Set(['moved', 'locallyMoved']);
const DELETED: ReadonlySet<ChangeKind> = new Set(['deleted', 'locallyDeleted']);

/** The pending changes, looked up by path, by the path they were moved from, and by the folder holding them. */
export interface PendingIndex {
  byPath: ReadonlyMap<string, PendingChange>;
  /** Moves by the path they left. */
  movedFrom: ReadonlyMap<string, PendingChange[]>;
  /** What each folder with a change of its own (moved, added, private, deleted) holds, at any depth. */
  inside: ReadonlyMap<string, PendingChange[]>;
  /** The changes of a pending merge, which cm checks in only all at once. */
  merged: PendingChange[];
}

export function indexPending(pending: PendingChange[]): PendingIndex {
  const byPath = new Map(pending.map((change) => [change.path, change]));
  const movedFrom = new Map<string, PendingChange[]>();
  const inside = new Map<string, PendingChange[]>();
  // The folders with a change of their own at or above each folder, worked out once per folder: a change costs one
  // lookup of its parent, however deep, and an append per such folder (at 500,000 changes, no list of parents each).
  const holdersAt = new Map<string, readonly string[]>([['', []]]);
  const holdersOf = (folder: string): readonly string[] => {
    const known = holdersAt.get(folder);
    if (known) return known;
    const above = holdersOf(parentOf(folder));
    const holder = byPath.get(folder);
    const holders = holder && isFolder(holder) && !isOnlyCheckedOut(holder) ? [...above, folder] : above;
    holdersAt.set(folder, holders);
    return holders;
  };
  for (const change of pending) {
    if (change.oldPath && hasAny(change, MOVED)) appendTo(movedFrom, change.oldPath, change);
    for (const folder of holdersOf(parentOf(change.path))) appendTo(inside, folder, change);
  }
  return { byPath, movedFrom, inside, merged: pending.filter((change) => change.mergeInfo) };
}

/**
 * What checking `changes` checks with them, so the check-in is one cm takes: the private, added or moved folders
 * holding them; for a moved folder, everything inside it but private items (cm takes it all, and they go in only when
 * one is checked); the move away from where an added item now is; for a deleted folder, the moves out of it; and for
 * a merge's change, all of the merge's ("All merge changes must be checked in together").
 */
export function neededWith(changes: PendingChange[], index: PendingIndex): PendingChange[] {
  return closure(changes, (change, reach) => {
    if (change.mergeInfo) index.merged.forEach(reach);
    forEachFolderAbove(change.path, (folder) => {
      const holder = index.byPath.get(folder);
      if (holder && needsIt(holder)) reach(holder);
    });
    if (isMovedFolder(change)) for (const held of index.inside.get(change.path) ?? []) if (goesInWithMovedFolder(held)) reach(held);
    if (hasAny(change, NEEDED_BY_WHAT_IT_HOLDS) && !hasAny(change, MOVED)) index.movedFrom.get(change.path)?.forEach(reach);
    if (isDeletedFolder(change)) movesOutOf(change.path, index).forEach(reach);
  });
}

/**
 * What unchecking `changes` unchecks with them, the other way round: what a private, added, moved or deleted folder
 * holds; for a change inside a moved folder, the folder and all it holds (it goes in whole or not at all); the item
 * added where a move left; the deleted folder a move leaves; and for a merge's change, all of the merge's.
 */
export function needingThem(changes: PendingChange[], index: PendingIndex): PendingChange[] {
  return closure(changes, (change, reach) => {
    if (change.mergeInfo) index.merged.forEach(reach);
    if (isFolder(change) && !isOnlyCheckedOut(change)) index.inside.get(change.path)?.forEach(reach);
    if (goesInWithMovedFolder(change)) {
      forEachFolderAbove(change.path, (folder) => {
        const holder = index.byPath.get(folder);
        if (holder && isMovedFolder(holder)) reach(holder);
      });
    }
    if (change.oldPath && hasAny(change, MOVED)) {
      const there = index.byPath.get(change.oldPath);
      if (there && hasAny(there, NEEDED_BY_WHAT_IT_HOLDS) && !hasAny(there, MOVED)) reach(there);
      forEachFolderAbove(change.oldPath, (folder) => {
        const holder = index.byPath.get(folder);
        if (holder && isDeletedFolder(holder)) reach(holder);
      });
    }
  });
}

/**
 * Whether a change goes in, from whether its box is checked, made consistent: one whose needed folder is unchecked
 * doesn't (a new file appearing in a folder the user left out), and one inside a checked moved folder does (a new
 * file appearing in it: cm takes it with the folder). A merge goes in whole or not at all.
 */
export function consistentlyIncluded(isChecked: (change: PendingChange) => boolean, index: PendingIndex): (change: PendingChange) => boolean {
  const wholeMerge = index.merged.every(isChecked);
  // Worked out once per folder and kept: a change then costs a lookup of its folder, as cheap to ask again per row.
  const leftOutAt = new Map<string, boolean>([['', false]]);
  const takenWholeAt = new Map<string, boolean>([['', false]]);

  /** Whether a folder at or above this one is needed by what it holds and unchecked. */
  const leftOut = (folder: string): boolean => {
    const known = leftOutAt.get(folder);
    if (known !== undefined) return known;
    const holder = index.byPath.get(folder);
    const answer = (holder !== undefined && needsIt(holder) && !isChecked(holder)) || leftOut(parentOf(folder));
    leftOutAt.set(folder, answer);
    return answer;
  };
  /** Whether a checked moved folder is at or above this one. */
  const takenWhole = (folder: string): boolean => {
    const known = takenWholeAt.get(folder);
    if (known !== undefined) return known;
    const holder = index.byPath.get(folder);
    const answer = (holder !== undefined && isMovedFolder(holder) && isChecked(holder)) || takenWhole(parentOf(folder));
    takenWholeAt.set(folder, answer);
    return answer;
  };
  const includedNow = (change: PendingChange): boolean => {
    if (change.mergeInfo && !wholeMerge) return false;
    const parent = parentOf(change.path);
    if (leftOut(parent)) return false;
    return isChecked(change) || (goesInWithMovedFolder(change) && takenWhole(parent));
  };
  return includedNow;
}

/** The paths a click checks or unchecks: the changes clicked and what they need, or what needs them (`neededWith`, `needingThem`). */
export function pathsCheckedTogether(changes: PendingChange[], include: boolean, index: PendingIndex): string[] {
  return (include ? neededWith(changes, index) : needingThem(changes, index)).map((change) => change.path);
}

function appendTo(lists: Map<string, PendingChange[]>, key: string, change: PendingChange): void {
  const list = lists.get(key);
  if (list) list.push(change);
  else lists.set(key, [change]);
}

/** The changes reached from `start` by `next`, each once, `start` first: no list is built for a step. */
function closure(start: PendingChange[], next: (change: PendingChange, reach: (found: PendingChange) => void) => void): PendingChange[] {
  const reached = new Map(start.map((change) => [change.path, change]));
  const queue = [...start];
  const reach = (found: PendingChange): void => {
    if (reached.has(found.path)) return;
    reached.set(found.path, found);
    queue.push(found);
  };
  for (let change = queue.pop(); change; change = queue.pop()) next(change, reach);
  return [...reached.values()];
}

/** The moves whose item was inside the deleted folder and now lives outside it. */
function movesOutOf(folder: string, index: PendingIndex): PendingChange[] {
  const moves: PendingChange[] = [];
  for (const [oldPath, moved] of index.movedFrom) if (isUnder(oldPath, folder)) moves.push(...moved.filter((move) => !isUnder(move.path, folder)));
  return moves;
}

/** A change cm takes with the moved folder holding it: any it checks in, but private items (only with `--private`). */
function goesInWithMovedFolder(change: PendingChange): boolean {
  return isCheckinCandidate(change) && !change.kinds.includes('private');
}

function needsIt(folder: PendingChange): boolean {
  return isFolder(folder) && hasAny(folder, NEEDED_BY_WHAT_IT_HOLDS);
}

function isMovedFolder(change: PendingChange): boolean {
  return isFolder(change) && hasAny(change, MOVED);
}

function isDeletedFolder(change: PendingChange): boolean {
  return isFolder(change) && hasAny(change, DELETED);
}

function isOnlyCheckedOut(folder: PendingChange): boolean {
  return folder.kinds.every((kind) => kind === 'checkedOut');
}

// cm status reads an xlink as a directory (`enDirectory`).
function isFolder(change: PendingChange): boolean {
  return change.itemType === 'directory';
}

function hasAny(change: PendingChange, kinds: ReadonlySet<ChangeKind>): boolean {
  return change.kinds.some((kind) => kinds.has(kind));
}

function isUnder(path: string, folder: string): boolean {
  return path.startsWith(`${folder}/`);
}

/** The folder holding the path, '' at the top ("a/b/c.cs": "a/b"). */
export function parentOf(path: string): string {
  const end = path.lastIndexOf('/');
  return end === -1 ? '' : path.slice(0, end);
}

/** Calls `visit` with each folder above the path, without building their list. */
function forEachFolderAbove(path: string, visit: (folder: string) => void): void {
  for (let end = path.indexOf('/'); end !== -1; end = path.indexOf('/', end + 1)) visit(path.slice(0, end));
}

/** Every folder above the path, outermost first ("a/b/c.cs": "a", "a/b"). */
export function foldersAbove(path: string): string[] {
  const folders: string[] = [];
  for (let end = path.indexOf('/'); end !== -1; end = path.indexOf('/', end + 1)) folders.push(path.slice(0, end));
  return folders;
}
