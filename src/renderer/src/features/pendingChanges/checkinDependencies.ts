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
}

export function indexPending(pending: PendingChange[]): PendingIndex {
  const byPath = new Map(pending.map((change) => [change.path, change]));
  const movedFrom = new Map<string, PendingChange[]>();
  const inside = new Map<string, PendingChange[]>();
  // One pass, each change appended in place: a moved folder holding 40,000 files costs 40,000 appends, not a copy each.
  for (const change of pending) {
    if (change.oldPath && hasAny(change, MOVED)) appendTo(movedFrom, change.oldPath, change);
    for (const folder of foldersAbove(change.path)) {
      const holder = byPath.get(folder);
      if (holder && isFolder(holder) && !isOnlyCheckedOut(holder)) appendTo(inside, folder, change);
    }
  }
  return { byPath, movedFrom, inside };
}

/**
 * What checking `changes` checks with them, so the check-in is one cm takes: the private, added or moved folders
 * holding them; for a moved folder, everything inside it but private items (cm takes it all, and they go in only when
 * one is checked); the move away from where an added item now is; and for a deleted folder, the moves out of it.
 */
export function neededWith(changes: PendingChange[], index: PendingIndex): PendingChange[] {
  return closure(changes, (change) => [
    ...foldersAbove(change.path).flatMap((folder) => neededFolder(folder, index)),
    ...(isMovedFolder(change) ? (index.inside.get(change.path) ?? []).filter(goesInWithMovedFolder) : []),
    ...(hasAny(change, NEEDED_BY_WHAT_IT_HOLDS) && !hasAny(change, MOVED) ? (index.movedFrom.get(change.path) ?? []) : []),
    ...(isDeletedFolder(change) ? movesOutOf(change.path, index) : []),
  ]);
}

/**
 * What unchecking `changes` unchecks with them, the other way round: what a private, added, moved or deleted folder
 * holds; for a change inside a moved folder, the folder and all it holds (it goes in whole or not at all); the item
 * added where a move left; and the deleted folder a move leaves.
 */
export function needingThem(changes: PendingChange[], index: PendingIndex): PendingChange[] {
  return closure(changes, (change) => [
    ...(isFolder(change) && !isOnlyCheckedOut(change) ? (index.inside.get(change.path) ?? []) : []),
    ...(goesInWithMovedFolder(change) ? foldersAbove(change.path).flatMap((folder) => movedFolderAt(folder, index)) : []),
    ...(change.oldPath && hasAny(change, MOVED) ? addedAt(change.oldPath, index) : []),
    ...(change.oldPath && hasAny(change, MOVED) ? foldersAbove(change.oldPath).flatMap((folder) => deletedFolderAt(folder, index)) : []),
  ]);
}

/**
 * Whether a change goes in, from whether its box is checked, made consistent: one whose needed folder is unchecked
 * doesn't (a new file appearing in a folder the user left out), and one inside a checked moved folder does (a new
 * file appearing in it: cm takes it with the folder).
 */
export function consistentlyIncluded(isChecked: (change: PendingChange) => boolean, index: PendingIndex): (change: PendingChange) => boolean {
  const checkedFolder = (folder: string, test: (holder: PendingChange) => boolean): boolean => {
    const holder = index.byPath.get(folder);
    return holder !== undefined && test(holder) && isChecked(holder);
  };
  // Asked once per change and row: the answer is kept, as the list renders rows again on every scroll.
  const answers = new Map<string, boolean>();
  return (change) => {
    const known = answers.get(change.path);
    if (known !== undefined) return known;
    const answer = includedNow(change);
    answers.set(change.path, answer);
    return answer;
  };

  function includedNow(change: PendingChange): boolean {
    const folders = foldersAbove(change.path);
    const needsAnUnchecked = folders.some((folder) => {
      const holder = index.byPath.get(folder);
      return holder !== undefined && needsIt(holder) && !isChecked(holder);
    });
    if (needsAnUnchecked) return false;
    return isChecked(change) || (goesInWithMovedFolder(change) && folders.some((folder) => checkedFolder(folder, isMovedFolder)));
  }
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

function closure(start: PendingChange[], next: (change: PendingChange) => PendingChange[]): PendingChange[] {
  const reached = new Map(start.map((change) => [change.path, change]));
  const queue = [...start];
  for (let change = queue.pop(); change; change = queue.pop()) {
    for (const found of next(change)) {
      if (reached.has(found.path)) continue;
      reached.set(found.path, found);
      queue.push(found);
    }
  }
  return [...reached.values()];
}

function neededFolder(folder: string, index: PendingIndex): PendingChange[] {
  const holder = index.byPath.get(folder);
  return holder && needsIt(holder) ? [holder] : [];
}

function movedFolderAt(folder: string, index: PendingIndex): PendingChange[] {
  const holder = index.byPath.get(folder);
  return holder && isMovedFolder(holder) ? [holder] : [];
}

function deletedFolderAt(folder: string, index: PendingIndex): PendingChange[] {
  const holder = index.byPath.get(folder);
  return holder && isDeletedFolder(holder) ? [holder] : [];
}

function addedAt(path: string, index: PendingIndex): PendingChange[] {
  const there = index.byPath.get(path);
  return there && hasAny(there, NEEDED_BY_WHAT_IT_HOLDS) && !hasAny(there, MOVED) ? [there] : [];
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

/** Every folder above the path, outermost first ("a/b/c.cs": "a", "a/b"). */
export function foldersAbove(path: string): string[] {
  const folders: string[] = [];
  for (let end = path.indexOf('/'); end !== -1; end = path.indexOf('/', end + 1)) folders.push(path.slice(0, end));
  return folders;
}
