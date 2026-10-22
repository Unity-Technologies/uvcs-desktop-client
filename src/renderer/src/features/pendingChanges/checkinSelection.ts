import type { PendingChange } from '@shared/domain/pendingChanges';
import type { CheckState } from '../../ui/Checkbox';
import { BulkPrivateTally, bulkPrivateFiles, isPrivateFolderAt, privateFoldersOf, type BulkPrivate, type PrivateFolders } from './bulkPrivate';
import { isCheckinCandidate, isShelvable } from './changeCategories';
import { UploadTally, uploadKindOf, type UploadKind, type UploadSummary } from './uploadSummary';
import { consistentlyIncluded, neededWith, type PendingIndex } from './checkinDependencies';

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
 * million changes; and with every box checked, nothing at all (`everythingCache`, filled the first time it's asked).
 */
export interface CheckinFacts {
  uploadKinds: UploadKind[];
  shelvable: Uint8Array;
  privateFolders: PrivateFolders;
  everythingCache: { selection?: Omit<CheckinSelection, 'isIncluded' | 'everyCandidateIncluded'> };
}

export function checkinFactsOf(all: PendingChange[]): CheckinFacts {
  return { uploadKinds: all.map(uploadKindOf), shelvable: Uint8Array.from(all, (change) => (isShelvable(change) ? 1 : 0)), privateFolders: privateFoldersOf(all), everythingCache: {} };
}

/**
 * What a check-in takes of the changes the filter shows, and what follows from it: what it uploads, what a shelve
 * takes, bulk private files. What you see is what goes in, with what it needs: a checked change the filter hides could
 * slip a private file into a changeset unseen, while one left out stays pending and shows again once the filter clears.
 * The checked changes the filter shows and what they need that it hides (a private file's private folder while
 * filtering by Changed) are found once (`neededWith`); then one pass over the list takes them, in its order.
 * Whether each change goes in is the user's `choice` (`currentChoice`) under the check-in rules (`consistentlyIncluded`).
 * With every box checked and nothing filtered, every change that can go in does, as the read's facts already say.
 */
export function checkinSelectionOf(listed: ListedChanges, choice: CheckinChoice): CheckinSelection {
  const { all, matchingFilter, index, facts } = listed;
  const isIncluded = consistentlyIncluded(includedBy(choice), index);
  if (matchingFilter === all && everyBoxChecked(choice, index)) {
    facts.everythingCache.selection ??= selectionOf(listed, isCheckinCandidate, null);
    return { isIncluded, everyCandidateIncluded: true, ...facts.everythingCache.selection };
  }
  const shown = matchingFilter === all ? null : matchingFilter.filter(isIncluded);
  const going = shown && new Set(neededWith(shown, index).filter(isIncluded));
  return { isIncluded, everyCandidateIncluded: false, ...selectionOf(listed, isIncluded, going, shown?.length) };
}

/**
 * Whether no box of a pending change that can go in is unchecked, and no changelist is prepared: paths unchecked that
 * are no longer pending (undone, checked in) leave every box checked.
 */
export function everyBoxChecked({ prepared, excludedPaths }: CheckinChoice, index: PendingIndex): boolean {
  if (prepared) return false;
  for (const path of excludedPaths) {
    const change = index.byPath.get(path);
    if (change && isCheckinCandidate(change)) return false;
  }
  return true;
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
 * The checks of the changes listed (what the filters show, review mode's "Unreviewed" too) that can go in
 * (`candidates`, found once per list): how many are checked, from the selection's count when they are what the filter
 * shows and counted again only when review mode narrows them; and how a row asks whether one is (`isChosen`), null
 * while every one is (`everyCandidateIncluded`), so a folder of a million needs no asking. `candidates` is
 * `listed.filter(isCheckinCandidate)`, which the caller keeps per list: a click doesn't filter it again.
 */
export interface ShownChecks {
  candidates: PendingChange[];
  checked: number;
  isChosen: ((change: PendingChange) => boolean) | null;
}

export function shownChecksOf(candidates: PendingChange[], listed: PendingChange[], matchingFilter: PendingChange[], selection: CheckinSelection): ShownChecks {
  const isChosen = selection.everyCandidateIncluded ? null : selection.isIncluded;
  if (listed === matchingFilter) return { candidates, checked: selection.shownIncludedCount, isChosen };
  let checked = 0;
  for (const change of candidates) if (selection.isIncluded(change)) checked++;
  return { candidates, checked, isChosen };
}

/** The check of the box above the list, over every change shown that can go in. */
export function shownCheckState({ candidates, checked }: ShownChecks): CheckState {
  if (checked === 0) return false;
  return checked === candidates.length ? true : 'mixed';
}
