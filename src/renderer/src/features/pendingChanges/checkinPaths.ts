import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { isCheckinCandidate } from './changeCategories';

/**
 * A folder's changes that cm takes along with any path given from inside it (its checkout, its add), so the folder's
 * own path needn't be given. A moved, deleted or private folder must be given itself: cm refuses what's inside it alone.
 */
const TAKEN_ALONG: ReadonlySet<ChangeKind> = new Set(['checkedOut', 'added']);

/** What to give `cm checkin` (or `cm shelveset create`) for a check-in of the changes the user checked. */
export interface CheckinPaths {
  paths: string[];
  /** Whether private items go in (`--private`), which only a checked private item asks for. */
  addsPrivate: boolean;
  /** Pending changes the user didn't check that go in anyway, inside a folder whose path is given. */
  pulledIn: PendingChange[];
}

/**
 * The paths that check in `included` and as little else as cm allows. cm takes everything under each path it is given,
 * with no way to take a folder alone: `--private` adds every private item there, and `--all` every change. So a
 * folder cm takes along by itself (a checkout, an add: `TAKEN_ALONG`) is left out when something under it is
 * given, and what a given folder takes that wasn't checked is `pulledIn`, for the user to agree to first. A checkout
 * inside a writable xlink checks the xlink out: given, it took every private file inside the xlink.
 */
export function checkinPathsOf(included: PendingChange[], pending: PendingChange[]): CheckinPaths {
  const addsPrivate = included.some((change) => change.kinds.includes('private'));
  const holdingIncluded = foldersAbove(included);
  const given = included.filter((change) => !isFolder(change) || !isTakenAlong(change) || !holdingIncluded.has(change.path));
  const givenFolders = new Set(given.filter(isFolder).map((change) => change.path));
  const includedPaths = new Set(included.map((change) => change.path));
  const goesInWithFolder = (change: PendingChange): boolean =>
    !includedPaths.has(change.path) && isCheckinCandidate(change) && (addsPrivate || !change.kinds.includes('private')) && isUnderAny(change.path, givenFolders);
  return { paths: given.map((change) => change.path), addsPrivate, pulledIn: givenFolders.size === 0 ? [] : pending.filter(goesInWithFolder) };
}

/** The outermost folders given that take along changes the user didn't check, for the question asked first. */
export function foldersPullingIn({ paths, pulledIn }: CheckinPaths): string[] {
  const pulling = new Set(paths.filter((path) => pulledIn.some((change) => change.path.startsWith(`${path}/`))));
  return [...pulling].filter((path) => !isUnderAny(path, pulling));
}

function isFolder(change: PendingChange): boolean {
  return change.itemType === 'directory' || change.itemType === 'xlink';
}

function isTakenAlong(folder: PendingChange): boolean {
  return folder.kinds.every((kind) => TAKEN_ALONG.has(kind));
}

/** Every folder path above the changes' paths ("a/b/c.cs": "a", "a/b"). */
function foldersAbove(changes: PendingChange[]): ReadonlySet<string> {
  const folders = new Set<string>();
  for (const { path } of changes) for (let end = path.indexOf('/'); end !== -1; end = path.indexOf('/', end + 1)) folders.add(path.slice(0, end));
  return folders;
}

/** Whether a folder in `folders` holds the path, walking up its parents: as many lookups as the path is deep. */
function isUnderAny(path: string, folders: ReadonlySet<string>): boolean {
  for (let end = path.lastIndexOf('/'); end !== -1; end = path.lastIndexOf('/', end - 1)) if (folders.has(path.slice(0, end))) return true;
  return false;
}
