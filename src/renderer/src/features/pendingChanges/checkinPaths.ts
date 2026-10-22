import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { isCheckinCandidate } from './changeCategories';
import { foldersAbove } from './checkinDependencies';

/**
 * A folder's changes that cm takes along with any path given from inside it, so the folder's own path needn't be
 * given: its checkout, and with `--dependencies` its add or its being private. A moved or deleted folder must be given
 * itself: cm refuses what's inside it alone ("the change '/lib' must be selected too").
 */
const TAKEN_ALONG: ReadonlySet<ChangeKind> = new Set(['checkedOut', 'added', 'private']);

/** What to give `cm checkin` (or `cm shelveset create`) for a check-in of the changes the user checked. */
export interface CheckinPaths {
  paths: string[];
  /** Whether private items go in (`--private`), which only a checked private item asks for. */
  addsPrivate: boolean;
  /** Pending changes the user didn't check that go in anyway, inside a folder whose path is given. */
  pulledIn: PendingChange[];
  /** The outermost folders given that take `pulledIn` along, for the question asked first. */
  pullingFolders: string[];
}

/**
 * The paths that check in `included` and as little else as cm allows. cm takes everything under each path it is given,
 * with no way to take a folder alone: `--private` adds every private item there, and `--all` every change. So a
 * folder cm takes along by itself (`TAKEN_ALONG`) is left out when something under it is given, and what a given folder
 * takes that wasn't checked is `pulledIn`, for the user to agree to first. Checking a change checks what it needs
 * (`neededWith`), so that is only what the user can't check by hand: private items in a moved folder, once some other
 * private item is checked. A checkout inside a writable xlink checks the xlink out: given, it took every private file
 * inside the xlink. One pass over the changes, looking up only the folders above each.
 */
export function checkinPathsOf(included: PendingChange[], pending: PendingChange[]): CheckinPaths {
  const addsPrivate = included.some((change) => change.kinds.includes('private'));
  const holdingIncluded = new Set(included.flatMap((change) => foldersAbove(change.path)));
  const given = included.filter((change) => !isFolder(change) || !isTakenAlong(change) || !holdingIncluded.has(change.path));
  const givenFolders = new Set(given.filter(isFolder).map((change) => change.path));
  if (givenFolders.size === 0) return { paths: given.map((change) => change.path), addsPrivate, pulledIn: [], pullingFolders: [] };

  const includedPaths = new Set(included.map((change) => change.path));
  const pulledIn: PendingChange[] = [];
  const pullingFolders = new Set<string>();
  for (const change of pending) {
    if (includedPaths.has(change.path) || !isCheckinCandidate(change) || (!addsPrivate && change.kinds.includes('private'))) continue;
    const outermost = foldersAbove(change.path).find((folder) => givenFolders.has(folder));
    if (outermost === undefined) continue;
    pulledIn.push(change);
    pullingFolders.add(outermost);
  }
  return { paths: given.map((change) => change.path), addsPrivate, pulledIn, pullingFolders: [...pullingFolders] };
}

// cm status reads an xlink as a directory (`enDirectory`).
function isFolder(change: PendingChange): boolean {
  return change.itemType === 'directory';
}

function isTakenAlong(folder: PendingChange): boolean {
  return folder.kinds.every((kind) => TAKEN_ALONG.has(kind));
}
