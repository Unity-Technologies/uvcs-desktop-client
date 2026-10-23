import type { ItemType, PendingChange } from '@shared/domain/pendingChanges';
import { comparePaths } from '@shared/pathOrder';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { extensionOf, fileNameOf } from '../../lib/text';

/**
 * Pairing by hand what the local-move detection (`detectLocalMoves`) didn't: an item deleted from disk and a private
 * one it became, recorded as a move (`api.pendingChanges.recordMove`) so its history goes on. "Search matches" in a
 * change's menu, on either side.
 */

/** Which side of a move the change can be: the item that went, or the one it became. */
export type MatchSide = 'deleted' | 'new';

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
 * The side of a move the change can take, or null. Only an item deleted from disk outside `cm` (a delete with `cm`
 * would have to be undone first) and a private one, nothing else pending on either. A private item inside a private
 * folder can't: `cm move` refuses a destination whose folder isn't under version control.
 */
export function matchSideOf(change: PendingChange, changes: readonly PendingChange[]): MatchSide | null {
  // Only a private item needs the private folders: a right-click on any other change reads no list.
  const folders = change.kinds.length === 1 && change.kinds[0] === 'private' ? privateFolders(changes) : NO_FOLDERS;
  return sideOf(change, folders);
}

const NO_FOLDERS: ReadonlySet<string> = new Set();

/**
 * The changes that could be the other side of the change's move, of the same type, the likeliest first
 * (`compareCandidates`). Which files `cm` would pair, text or binary, is told from their content as they're measured
 * (`api.pendingChanges.moveSimilarities`).
 */
export function matchCandidates(change: PendingChange, changes: readonly PendingChange[]): PendingChange[] {
  const folders = privateFolders(changes);
  const side = sideOf(change, folders);
  if (side === null) return [];
  const otherSide: MatchSide = side === 'deleted' ? 'new' : 'deleted';
  return changes
    .filter((other) => SHAPES[other.itemType] === SHAPES[change.itemType] && sideOf(other, folders) === otherSide)
    .sort((a, b) => compareCandidates(change.path, a.path, b.path));
}

/** The candidates the dialog's search leaves: each word typed in the path (`matchesWordFilter`), as the list marks them. */
export function searchedCandidates(candidates: readonly PendingChange[], search: string): readonly PendingChange[] {
  return search.trim() ? candidates.filter((candidate) => matchesWordFilter([candidate.path], search)) : candidates;
}

/** The move a pick records: from the deleted item to the new one, whichever side the change is. */
export function moveMatchOf(change: PendingChange, picked: PendingChange, side: MatchSide): MoveMatch {
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

function sideOf(change: PendingChange, folders: ReadonlySet<string>): MatchSide | null {
  if (change.kinds.length !== 1 || SHAPES[change.itemType] === undefined) return null;
  if (change.kinds[0] === 'locallyDeleted') return 'deleted';
  return change.kinds[0] === 'private' && !isInPrivateFolder(change, folders) ? 'new' : null;
}

function privateFolders(changes: readonly PendingChange[]): Set<string> {
  return new Set(changes.filter((change) => change.itemType === 'directory' && change.kinds.includes('private')).map((change) => change.path));
}

function isInPrivateFolder(change: PendingChange, folders: ReadonlySet<string>): boolean {
  for (let end = change.path.lastIndexOf('/'); end > 0; end = change.path.lastIndexOf('/', end - 1)) {
    if (folders.has(change.path.slice(0, end))) return true;
  }
  return false;
}
