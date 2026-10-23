import type { ChangeKind, ItemType, PendingChange } from '@shared/domain/pendingChanges';
import { comparePaths } from '@shared/pathOrder';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { extensionOf, fileNameOf } from '../../lib/text';

/**
 * Pairing by hand an item deleted from disk and the new one it became, recorded as a move
 * (`api.pendingChanges.recordMove`) so its history goes on: what the local-move detection (`detectLocalMoves`) didn't
 * pair, or paired with the wrong item. "Search matches" in a change's menu, on either side.
 */

/** Which side of a move the change can be: the item that went, or the one it became. */
export type MatchSide = 'deleted' | 'new';

/**
 * An item that could be the other side of the change's move: a deleted one where it was, a new one where it is. One the
 * detection paired with another item says which (`pairedWith`): picking it replaces that pairing, the other item
 * deleted or new again.
 */
export interface MatchCandidate {
  path: string;
  itemType: ItemType;
  pairedWith?: string;
}

/** The two items of a move to record: `cm move <from> <to>`. */
export interface MoveMatch {
  from: string;
  to: string;
}

/**
 * Files pair with files, folders with folders: `cm move` of a file onto a folder moves it inside the folder. Changes
 * knows no file's kind (`cm status --machinereadable` names none), so text and binary are told apart as they're
 * measured; any kind of file is one shape here.
 */
type MatchShape = 'file' | 'folder';

const SHAPES: Partial<Record<ItemType, MatchShape>> = { file: 'file', binaryFile: 'file', directory: 'folder' };

/**
 * The side of a move the change can take, or null. An item deleted from disk outside `cm` (a delete with `cm` would
 * have to be undone first) takes the deleted side; a private one, or the new item of a move the detection made
 * (`isDetectedMove`: its row is where the item is now), the new side. Nothing else pending on either, but for a
 * detected move's content change. A new item inside a private folder can't: `cm move` refuses a destination whose
 * folder isn't under version control.
 */
export function matchSideOf(change: PendingChange, changes: readonly PendingChange[]): MatchSide | null {
  if (SHAPES[change.itemType] === undefined) return null;
  if (isOnly(change, 'locallyDeleted')) return 'deleted';
  if (!isOnly(change, 'private') && !isDetectedMove(change)) return null;
  // Only a new item needs the private folders: a right-click on any other change reads no list.
  return isInPrivateFolder(change.path, privateFolders(changes)) ? null : 'new';
}

/**
 * The changes that could be the other side of the change's move, of the same type, the likeliest first
 * (`compareCandidates`). Which files `cm` would pair, text or binary, is told from their content as they're measured
 * (`api.pendingChanges.moveSimilarities`).
 */
export function matchCandidates(change: PendingChange, changes: readonly PendingChange[]): MatchCandidate[] {
  const side = matchSideOf(change, changes);
  if (side === null) return [];
  const shape = SHAPES[change.itemType];
  const candidates = side === 'deleted' ? newItems(changes) : deletedItems(changes);
  return candidates.filter((candidate) => SHAPES[candidate.itemType] === shape).sort((a, b) => compareCandidates(change.path, a.path, b.path));
}

/** Where each item that went was: deleted from disk, or the deleted item of a detected move. */
function deletedItems(changes: readonly PendingChange[]): MatchCandidate[] {
  return changes.flatMap((change): MatchCandidate[] => {
    if (isOnly(change, 'locallyDeleted')) return [{ path: change.path, itemType: change.itemType }];
    return isDetectedMove(change) ? [{ path: change.oldPath!, itemType: change.itemType, pairedWith: change.path }] : [];
  });
}

/** Where each item that came is: private, or the new item of a detected move; never inside a private folder. */
function newItems(changes: readonly PendingChange[]): MatchCandidate[] {
  const folders = privateFolders(changes);
  return changes.flatMap((change): MatchCandidate[] => {
    if (isInPrivateFolder(change.path, folders)) return [];
    if (isOnly(change, 'private')) return [{ path: change.path, itemType: change.itemType }];
    return isDetectedMove(change) ? [{ path: change.path, itemType: change.itemType, pairedWith: change.oldPath }] : [];
  });
}

/**
 * A move `cm status` found by itself (`locallyMoved`), which nothing records yet: a pick by hand can replace it. Its
 * content may have changed too; one with anything else pending (a checkout) is left as it is.
 */
export function isDetectedMove({ kinds, oldPath }: Pick<PendingChange, 'kinds' | 'oldPath'>): boolean {
  return oldPath !== undefined && kinds.includes('locallyMoved') && kinds.every((kind) => kind === 'locallyMoved' || kind === 'changed');
}

/** The candidates the dialog's search leaves: each word typed in the path (`matchesWordFilter`), as the list marks them. */
export function searchedCandidates(candidates: readonly MatchCandidate[], search: string): readonly MatchCandidate[] {
  return search.trim() ? candidates.filter((candidate) => matchesWordFilter([candidate.path], search)) : candidates;
}

/** The move a pick records: from the deleted item to the new one, whichever side the change is. */
export function moveMatchOf(change: PendingChange, picked: MatchCandidate, side: MatchSide): MoveMatch {
  return side === 'deleted' ? { from: change.path, to: picked.path } : { from: picked.path, to: change.path };
}

/**
 * The likeliest match of `path` first: the same name (a move), then the same extension (a rename), then the one in
 * the closest folder (more folders in common, then fewer of its own past them); then in path order (`comparePaths`).
 */
export function compareCandidates(path: string, a: string, b: string): number {
  const sharedA = sharedFolders(path, a);
  const sharedB = sharedFolders(path, b);
  return (
    likeness(path, b) - likeness(path, a) ||
    sharedB - sharedA ||
    folderDepth(a) - sharedA - (folderDepth(b) - sharedB) ||
    comparePaths(a, b)
  );
}

function likeness(path: string, other: string): number {
  if (fileNameOf(path).toLowerCase() === fileNameOf(other).toLowerCase()) return 2;
  const extension = extensionOf(path)?.toLowerCase();
  return extension !== undefined && extension === extensionOf(other)?.toLowerCase() ? 1 : 0;
}

/** How many folders, from the root, the two paths have in common. */
function sharedFolders(a: string, b: string): number {
  const foldersA = a.split('/').slice(0, -1);
  const foldersB = b.split('/').slice(0, -1);
  let shared = 0;
  while (shared < foldersA.length && foldersA[shared] === foldersB[shared]) shared++;
  return shared;
}

function folderDepth(path: string): number {
  return path.split('/').length - 1;
}

function isOnly(change: PendingChange, kind: ChangeKind): boolean {
  return change.kinds.length === 1 && change.kinds[0] === kind;
}

function privateFolders(changes: readonly PendingChange[]): Set<string> {
  return new Set(changes.filter((change) => change.itemType === 'directory' && change.kinds.includes('private')).map((change) => change.path));
}

function isInPrivateFolder(path: string, folders: ReadonlySet<string>): boolean {
  for (let end = path.lastIndexOf('/'); end > 0; end = path.lastIndexOf('/', end - 1)) {
    if (folders.has(path.slice(0, end))) return true;
  }
  return false;
}
