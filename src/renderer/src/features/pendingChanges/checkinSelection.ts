import type { PendingChange } from '@shared/domain/pendingChanges';
import { BulkPrivateTally, bulkPrivateFiles, isPrivateFolderAt, privateFoldersOf, type BulkPrivate, type PrivateFolders } from './bulkPrivate';
import { isCheckinCandidate, isShelvable } from './changeCategories';
import { UploadTally, uploadKindOf, type UploadKind, type UploadSummary } from './uploadSummary';
import { neededWith, type PendingIndex } from './checkinDependencies';

export interface CheckinSelection {
  isIncluded: (change: PendingChange) => boolean;
  /**
   * Every change that can go in does (every box checked, nothing filtered): `isIncluded` is `isCheckinCandidate`, so a
   * folder of a million tells its check at once (`checkStateOver`).
   */
  everyCandidateIncluded: boolean;
  /**
   * The checked changes the filter shows, and what they need that it hides (`neededWith`): the rest it hides stay out
   * of the check-in, still checked for when they show again.
   */
  included: PendingChange[];
  /** How many checked changes the filter hides. */
  hiddenIncludedCount: number;
  /** How many of the changes the filter shows are checked: the box above the list. */
  shownIncludedCount: number;
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
  /** What each of them adds to a check-in (`checkinFactsOf`). */
  facts: CheckinFacts;
}

/**
 * What each change of a read adds to a check-in, worked out once per read and aligned with the list (`all`): its
 * upload, whether a shelve takes it, the folder a private file counts in. A click on a box then only asks each change
 * whether it goes in (`checkinSelectionOf`), where working it all out again took a third of a second a click for a
 * million changes; and with every box checked, nothing at all (`everything`, worked out the first time it's asked).
 */
export interface CheckinFacts {
  uploadKinds: UploadKind[];
  shelvable: Uint8Array;
  privateFolders: PrivateFolders;
  everything: { selection?: Omit<CheckinSelection, 'isIncluded' | 'everyCandidateIncluded'> };
}

export function checkinFactsOf(all: PendingChange[]): CheckinFacts {
  return { uploadKinds: all.map(uploadKindOf), shelvable: Uint8Array.from(all, (change) => (isShelvable(change) ? 1 : 0)), privateFolders: privateFoldersOf(all), everything: {} };
}

/**
 * What a check-in takes of the changes the filter shows, and what follows from it: what it uploads, what a shelve
 * takes, bulk private files. What you see is what goes in, with what it needs: a checked change the filter hides could
 * slip a private file into a changeset unseen, while one left out stays pending and shows again once the filter clears.
 * The checked changes the filter shows and what they need that it hides (a private file's private folder while
 * filtering by Changed) are found once (`neededWith`); then one pass over the list takes them, in its order.
 * `everyChecked`: no box is unchecked and no changelist prepared, when, with nothing filtered, every change that can go
 * in does, as the read's facts already say.
 */
export function checkinSelectionOf(listed: ListedChanges, isIncluded: (change: PendingChange) => boolean, everyChecked = false): CheckinSelection {
  const { all, matchingFilter, index, facts } = listed;
  if (everyChecked && matchingFilter === all) {
    facts.everything.selection ??= selectionOf(listed, isCheckinCandidate, null);
    return { isIncluded, everyCandidateIncluded: true, ...facts.everything.selection };
  }
  const shown = matchingFilter === all ? null : matchingFilter.filter(isIncluded);
  const going = shown && new Set(neededWith(shown, index).filter(isIncluded));
  return { isIncluded, everyCandidateIncluded: false, ...selectionOf(listed, isIncluded, going, shown?.length) };
}

/** The pass over the list: what `isIncluded` takes, or, while filtering, what is `going`. */
function selectionOf(
  { all, facts }: ListedChanges,
  isIncluded: (change: PendingChange) => boolean,
  going: ReadonlySet<PendingChange> | null,
  shownIncludedCount?: number,
): Omit<CheckinSelection, 'isIncluded' | 'everyCandidateIncluded'> {
  const { uploadKinds, shelvable: canShelve, privateFolders } = facts;
  const included: PendingChange[] = [];
  const shelvable: PendingChange[] = [];
  const [upload, shelvableUpload] = [new UploadTally(), new UploadTally()];
  const bulk = new BulkPrivateTally(privateFolders);
  let hiddenIncludedCount = 0;
  let privateFolderLeftOut = false;
  all.forEach((change, index) => {
    const goes = going ? going.has(change) : isIncluded(change);
    if (!goes) {
      if (going && isIncluded(change)) hiddenIncludedCount++;
      privateFolderLeftOut ||= isPrivateFolderAt(privateFolders, index);
      return;
    }
    const kind = uploadKinds[index];
    included.push(change);
    upload.add(change, kind);
    if (canShelve[index]) {
      shelvable.push(change);
      shelvableUpload.add(change, kind);
    }
    bulk.add(change, index);
  });
  return {
    included,
    hiddenIncludedCount,
    shownIncludedCount: shownIncludedCount ?? included.length,
    upload: upload.summary(),
    shelvable,
    shelvableUpload: shelvableUpload.summary(),
    // Without one of their private folders, files are counted in another: worked out again for them.
    bulkPrivate: privateFolderLeftOut ? bulkPrivateFiles(included) : bulk.result(),
  };
}

/**
 * How many of the changes listed (`listed`: what the filters show, review mode's "Unreviewed" too) are checked: the
 * selection's count when they are what the filter shows, counted again only when review mode narrows them.
 */
export function checkedAmong(listed: PendingChange[], matchingFilter: PendingChange[], selection: Pick<CheckinSelection, 'isIncluded' | 'shownIncludedCount'>): number {
  if (listed === matchingFilter) return selection.shownIncludedCount;
  let count = 0;
  for (const change of listed) if (selection.isIncluded(change)) count++;
  return count;
}
