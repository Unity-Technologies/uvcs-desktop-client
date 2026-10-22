import type { PendingChange } from '@shared/domain/pendingChanges';
import { bulkPrivateFiles, type BulkPrivate } from './bulkPrivate';
import { isCheckinCandidate, isShelvable } from './changeCategories';
import { uploadSummary, type UploadSummary } from './uploadSummary';
import { neededWith, type PendingIndex } from './checkinDependencies';

export interface CheckinSelection {
  isIncluded: (change: PendingChange) => boolean;
  /** The checked changes the filter shows: those it hides stay out of the check-in, still checked for when they show again. */
  included: PendingChange[];
  /** How many checked changes the filter hides. */
  hiddenIncludedCount: number;
  upload: UploadSummary;
  /** What a shelve takes of them: private files stay out. */
  shelvable: PendingChange[];
  shelvableUpload: UploadSummary;
  bulkPrivate: BulkPrivate | null;
}

/**
 * A changelist readied to check in or shelve alone ("Check in this changelist"): only these paths go in, so a change
 * that appears meanwhile (an editor saving, a new `.meta`) stays out. Checking files by hand adds or takes them here.
 */
export interface PreparedChangelist {
  name: string;
  paths: ReadonlySet<string>;
}

/** What the user checked for the next check-in. */
export interface CheckinChoice {
  /** Paths the user unchecked. New changes are included by default, so we remember exclusions. */
  excludedPaths: ReadonlySet<string>;
  /** While set, it alone says what goes in; `excludedPaths` waits, as it was, for it to end. */
  prepared: PreparedChangelist | null;
}

/** Whether a change goes into the check-in: any that can be checked in, unless its box was unchecked. */
export function includedBy({ excludedPaths, prepared }: CheckinChoice): (change: PendingChange) => boolean {
  if (prepared) return (change) => isCheckinCandidate(change) && prepared.paths.has(change.path);
  return (change) => isCheckinCandidate(change) && !excludedPaths.has(change.path);
}

/** The choice once the user checks every file, none hidden: no changelist prepared, and none of `paths` left out. */
export function withEverythingIncluded(choice: CheckinChoice, paths: string[]): CheckinChoice {
  return { prepared: null, excludedPaths: withIncluded({ ...choice, prepared: null }, paths, true).excludedPaths };
}

/**
 * Whether the prepared changelist still holds a pending change, checked or not. By the changelist, not the paths: an
 * added file undone stays on disk, private, at its path, and files the user checked besides don't keep it going.
 */
export function preparedStillPending(prepared: PreparedChangelist, allChanges: PendingChange[]): boolean {
  return allChanges.some((change) => change.changelist === prepared.name);
}

/**
 * The choice that holds for `allChanges`: a prepared changelist none of whose files is pending anymore (undone, shelved
 * away by a switch, checked in from outside the app) has ended, and the files the user left out are the only ones out.
 */
export function currentChoice(choice: CheckinChoice, allChanges: PendingChange[]): CheckinChoice {
  return choice.prepared && !preparedStillPending(choice.prepared, allChanges) ? { ...choice, prepared: null } : choice;
}

/** The choice once the user checks (or unchecks) `paths` by hand: in a prepared changelist's paths while there is one. */
export function withIncluded(choice: CheckinChoice, paths: string[], included: boolean): CheckinChoice {
  if (choice.prepared) {
    const preparedPaths = new Set(choice.prepared.paths);
    paths.forEach((path) => (included ? preparedPaths.add(path) : preparedPaths.delete(path)));
    return { ...choice, prepared: { ...choice.prepared, paths: preparedPaths } };
  }
  const excludedPaths = new Set(choice.excludedPaths);
  paths.forEach((path) => (included ? excludedPaths.delete(path) : excludedPaths.add(path)));
  return { ...choice, excludedPaths };
}

/**
 * The changes Changes lists: all of them, and those its text and status filters show (`useChangeFilter`'s `visible`,
 * the very list when nothing filters). Review mode's "Unreviewed" filter isn't one of them: it hides each file as it's
 * reviewed, and those are the ones to check in.
 */
export interface ListedChanges {
  all: PendingChange[];
  matchingFilter: PendingChange[];
  /** All of them, indexed for what each needs (`indexPending`). */
  index: PendingIndex;
}

/**
 * The changes shown and checked, and what they need that the filter hides (a private file's private folder while
 * filtering by Changed): checked with them, they go in with them. In the listed order.
 */
function withWhatTheyNeed(shown: PendingChange[], all: PendingChange[], index: PendingIndex, isIncluded: (change: PendingChange) => boolean): PendingChange[] {
  const going = new Set(neededWith(shown, index).filter(isIncluded).map((change) => change.path));
  return all.filter((change) => going.has(change.path));
}

/**
 * What a check-in takes of the changes the filter shows, and what follows from it: what it uploads, what a shelve
 * takes, bulk private files. What you see is what goes in: a checked change the filter hides could slip a private file
 * into a changeset unseen, while one left out stays pending and shows again once the filter clears.
 */
export function checkinSelectionOf({ all, matchingFilter, index }: ListedChanges, isIncluded: (change: PendingChange) => boolean): CheckinSelection {
  const included = matchingFilter === all ? all.filter(isIncluded) : withWhatTheyNeed(matchingFilter.filter(isIncluded), all, index, isIncluded);
  const shelvable = included.filter(isShelvable);
  return {
    isIncluded,
    included,
    hiddenIncludedCount: matchingFilter === all ? 0 : all.filter(isIncluded).length - included.length,
    upload: uploadSummary(included),
    shelvable,
    shelvableUpload: uploadSummary(shelvable),
    bulkPrivate: bulkPrivateFiles(included),
  };
}
