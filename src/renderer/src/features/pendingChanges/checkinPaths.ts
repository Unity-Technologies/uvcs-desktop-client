import type { ChangeKind, PendingChange } from '@shared/domain/pendingChanges';
import { isCheckinCandidate } from './changeCategories';
import { parentOf } from '../../lib/paths';

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
 * with no way to take a folder alone: `--private` adds every private item there, and `--all` every change. So:
 * - a folder cm takes along by itself (`TAKEN_ALONG`) is left out when something under it is given;
 * - a private, added or moved folder goes alone when everything cm would take in it is checked: a new project added
 *   whole is one path, not one per file;
 * - a checked-out folder never goes alone: given, an xlink took the private files inside it;
 * - what a given folder takes that wasn't checked is `pulledIn`, for the user to agree to first. Checking a change
 *   checks what it needs (`neededWith`), so that is only what a checked folder must take: private items in a moved
 *   folder once some other private item is checked, or the files of an added or checked-out folder checked without
 *   them.
 * One pass over the changes, each folder's answer worked out once.
 */
export function checkinPathsOf(included: PendingChange[], pending: PendingChange[]): CheckinPaths {
  const addsPrivate = included.some((change) => change.kinds.includes('private'));
  const includedPaths = new Set(included.map((change) => change.path));
  const left = pending.filter((change) => !includedPaths.has(change.path) && isCheckinCandidate(change) && (addsPrivate || !change.kinds.includes('private')));
  const holdingLeft = foldersHolding(left);
  const holdingIncluded = foldersHolding(included);
  const whole = new Set(included.filter((change) => isFolder(change) && hasOwnChange(change) && !holdingLeft.has(change.path)).map((change) => change.path));
  const insideWhole = nearestAbove(whole);
  const given = included.filter(
    (change) => insideWhole(parentOf(change.path)) === undefined && (!isFolder(change) || whole.has(change.path) || !isTakenAlong(change) || !holdingIncluded.has(change.path)),
  );
  const givenFolders = new Set(given.filter(isFolder).map((change) => change.path));
  if (givenFolders.size === 0) return { paths: given.map((change) => change.path), addsPrivate, pulledIn: [], pullingFolders: [] };

  const outermostGiven = outermostAbove(givenFolders);
  const pulledIn: PendingChange[] = [];
  const pullingFolders = new Set<string>();
  for (const change of left) {
    const outermost = outermostGiven(parentOf(change.path));
    if (outermost === undefined) continue;
    pulledIn.push(change);
    pullingFolders.add(outermost);
  }
  return { paths: given.map((change) => change.path), addsPrivate, pulledIn, pullingFolders: [...pullingFolders] };
}

/**
 * Every folder above the changes. Walking up stops at a folder already found, so 500,000 files in 10,000 folders cost
 * about 510,000 steps, not one per folder above each file.
 */
function foldersHolding(changes: PendingChange[]): ReadonlySet<string> {
  const folders = new Set<string>();
  for (const change of changes) {
    for (let folder = parentOf(change.path); folder !== '' && !folders.has(folder); folder = parentOf(folder)) folders.add(folder);
  }
  return folders;
}

/** The nearest of `folders` at or above a folder ('' for none), worked out once per folder asked. */
function nearestAbove(folders: ReadonlySet<string>): (folder: string) => string | undefined {
  const found = new Map<string, string | undefined>([['', undefined]]);
  const nearest = (folder: string): string | undefined => {
    if (found.has(folder)) return found.get(folder);
    const answer = folders.has(folder) ? folder : nearest(parentOf(folder));
    found.set(folder, answer);
    return answer;
  };
  return nearest;
}

/** The outermost of `folders` at or above a folder, worked out once per folder asked. */
function outermostAbove(folders: ReadonlySet<string>): (folder: string) => string | undefined {
  const found = new Map<string, string | undefined>([['', undefined]]);
  const outermost = (folder: string): string | undefined => {
    if (found.has(folder)) return found.get(folder);
    const answer = outermost(parentOf(folder)) ?? (folders.has(folder) ? folder : undefined);
    found.set(folder, answer);
    return answer;
  };
  return outermost;
}

function hasOwnChange(folder: PendingChange): boolean {
  return folder.kinds.some((kind) => kind !== 'checkedOut');
}

// cm status reads an xlink as a directory (`enDirectory`).
function isFolder(change: PendingChange): boolean {
  return change.itemType === 'directory';
}

function isTakenAlong(folder: PendingChange): boolean {
  return folder.kinds.every((kind) => TAKEN_ALONG.has(kind));
}
