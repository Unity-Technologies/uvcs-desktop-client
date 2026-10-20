import type { Changeset } from '@shared/domain/changeset';
import type { QueryFilter } from '@shared/domain/query';
import { shortBranchName } from '@shared/domain/specs';
import type { Label } from '@shared/domain/label';
import { EVERYONE, isEveryone, pickedOwners, type PeoplePick } from '../../lib/peopleFilter';
import { longerRangeHint } from '../../lib/longerRangeHint';
import { typedChangesetNumber } from '../../lib/changesetNumber';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { sinceDateFor, type SincePreset } from '../../lib/sincePresets';
import { firstLine, formatCount } from '../../lib/text';
import { userFilterTexts } from '../../lib/userName';
import type { ViewFilters } from '../../lib/viewFilters';

/** Keeps "Any time" usable on huge repositories. */
const ANY_TIME_LIMIT = 2000;

/**
 * A branch picked by name, with the workspace it was picked in: the store outlives the workspace a window shows, and
 * another workspace's repository may have no such branch, or another one by that name. It holds the time range and
 * people its history shows with, its own for the session, so picking a branch never changes what the view remembers.
 */
export interface PickedBranch {
  workspacePath: string;
  name: string;
  since: SincePreset;
  people: PeoplePick;
}

export interface ChangesetFilters extends ViewFilters {
  since: SincePreset;
  /** Only the branch the workspace is on, following it as the workspace switches ("This branch"). */
  onlyCurrentBranch: boolean;
  /** Only this branch, kept for the session (`CHANGESET_SESSION_FILTERS`); while it applies, "This branch" doesn't. */
  pickedBranch: PickedBranch | null;
}

export const DEFAULT_CHANGESET_FILTERS: ChangesetFilters = { text: '', people: EVERYONE, since: 'lastMonth', onlyCurrentBranch: false, pickedBranch: null };

/** Every branch's changesets: what "Clear filters" resets besides the text and the people. */
export const ALL_BRANCHES: Pick<ChangesetFilters, 'onlyCurrentBranch' | 'pickedBranch'> = { onlyCurrentBranch: false, pickedBranch: null };
export const CLEARED_CHANGESET_FILTERS: Partial<ChangesetFilters> = ALL_BRANCHES;

/** Only the workspace's branch, whichever it is on. */
export const CURRENT_BRANCH: Pick<ChangesetFilters, 'onlyCurrentBranch' | 'pickedBranch'> = { onlyCurrentBranch: true, pickedBranch: null };

/**
 * Only `name`'s changesets, in this workspace, from its menu ("Show changesets") or the branch chip alike: its whole
 * history (Any time, capped as always) by everyone, with no text hiding some. The time range, the people and "This
 * branch" the view remembers stay as they were, and show again once the pick is cleared.
 */
export function pickedBranchFilters(workspacePath: string, name: string): Pick<ChangesetFilters, 'text' | 'pickedBranch'> {
  return { text: '', pickedBranch: { workspacePath, name, since: 'anyTime', people: EVERYONE } };
}

/** A branch picked by name is the repository's, so it is kept for the session, as the people picked by name are. */
export const CHANGESET_SESSION_FILTERS: readonly (keyof ChangesetFilters)[] = ['pickedBranch'];

/** The time range and people the view shows and reads with. */
export type ShownFilters = Pick<ChangesetFilters, 'since' | 'people'>;

/** The branch picked in `workspacePath`; one picked in another workspace is none here. */
function pickedIn(pickedBranch: PickedBranch | null, workspacePath: string): PickedBranch | null {
  return pickedBranch?.workspacePath === workspacePath ? pickedBranch : null;
}

/** The time range and people shown: the picked branch's own while one applies here, else those the view remembers. */
export function shownFilters({ since, people, pickedBranch }: Pick<ChangesetFilters, 'since' | 'people' | 'pickedBranch'>, workspacePath: string): ShownFilters {
  const picked = pickedIn(pickedBranch, workspacePath);
  return picked ? { since: picked.since, people: picked.people } : { since, people };
}

/** A change to the time range or the people goes to the picked branch while one applies here, so the remembered ones stay. */
export function shownFiltersChange(pickedBranch: PickedBranch | null, workspacePath: string, change: Partial<ShownFilters>): Partial<ChangesetFilters> {
  const picked = pickedIn(pickedBranch, workspacePath);
  return picked ? { pickedBranch: { ...picked, ...change } } : change;
}

/** Whose changesets the view reads: every branch's, the branch the workspace is on, or a branch picked by name. */
export type BranchScope = { kind: 'all' } | { kind: 'current'; name: string } | { kind: 'picked'; name: string };

/**
 * The branch filter as it applies in `workspacePath`: a branch picked in another workspace is none here, and "This
 * branch" is none while the workspace is on no branch (a label, a changeset).
 */
export function branchScopeIn(
  { onlyCurrentBranch, pickedBranch }: Pick<ChangesetFilters, 'onlyCurrentBranch' | 'pickedBranch'>,
  workspacePath: string,
  currentBranch: string | undefined,
): BranchScope {
  const picked = pickedIn(pickedBranch, workspacePath);
  if (picked) return { kind: 'picked', name: picked.name };
  if (onlyCurrentBranch && currentBranch) return { kind: 'current', name: currentBranch };
  return { kind: 'all' };
}

/** The branch whose changesets the scope reads; undefined for every branch. */
export function branchOf(scope: BranchScope): string | undefined {
  return scope.kind === 'all' ? undefined : scope.name;
}

/** Whether "Clear filters" would show more: text, the people shown, or a branch that applies here. */
export function isFilteringChangesets(text: string, shown: ShownFilters, scope: BranchScope): boolean {
  return text.trim() !== '' || !isEveryone(shown.people) || scope.kind !== 'all';
}

/**
 * What to ask `cm find` for: the time range, the people and the branch, so "Any time" (capped) finds the people's
 * newest ones and not those among everyone's newest. The text is matched locally, so typing stays instant. "This
 * branch" and the same branch picked by name ask the same query (`branchOf`).
 */
export function toQueryFilter({ since, people }: Pick<ChangesetFilters, 'since' | 'people'>, branch: string | undefined, today: Date): QueryFilter {
  return {
    sinceDate: sinceDateFor(since, today),
    owners: pickedOwners(people),
    branch,
    limit: since === 'anyTime' ? ANY_TIME_LIMIT : undefined,
  };
}

/** Whether each word of the search is in the changeset's number, comment, labels, branch or author (as shown or as stored). */
export function matchesSearch(changeset: Changeset, search: string, labels: readonly Label[] = []): boolean {
  return matchesWordFilter(
    [String(changeset.id), changeset.comment, ...labels.map((label) => label.name), changeset.branch, ...userFilterTexts(changeset.owner)],
    search,
  );
}

/**
 * A changeset a picker offers: one of those read, with its row; one typed by number that the read can't rule out
 * (older than those read); or, `missing`, a number typed that names no changeset, offered but not picked.
 */
export interface ChangesetChoice {
  id: number;
  changeset?: Changeset;
  missing?: true;
}

/**
 * The changesets a changeset picker offers for `search`, leaving out `exclude` (the one being compared): the newest
 * read (`recent`, at most `readLimit` of them; undefined while unread or when the read failed) whose row matches it,
 * and first the one whose number was typed (`1234`, `cs:1234`), so any changeset is reachable without listing them all.
 */
export function changesetChoices(recent: readonly Changeset[] | undefined, readLimit: number, exclude: number, search: string): ChangesetChoice[] {
  const typed = typedChangesetNumber(search);
  const matching = (recent ?? [])
    .filter((changeset) => changeset.id !== exclude && changeset.id !== typed && matchesWordFilter(changesetRowTexts(changeset), search))
    .map((changeset) => ({ id: changeset.id, changeset }));
  if (typed === undefined || typed === exclude) return matching;
  return [typedChoice(typed, recent, readLimit), ...matching];
}

/** What a picker's row shows: the number, the comment's first line, the branch's own name. */
function changesetRowTexts(changeset: Changeset): string[] {
  return [String(changeset.id), firstLine(changeset.comment), shortBranchName(changeset.branch)];
}

/** A number typed: its row when read; else whether a changeset can have it, from what the read covered. */
function typedChoice(id: number, recent: readonly Changeset[] | undefined, readLimit: number): ChangesetChoice {
  const read = recent?.find((changeset) => changeset.id === id);
  if (read) return { id, changeset: read };
  if (!recent || recent.length === 0) return { id };
  // Older than a read that stopped at its limit. A newer one would be checked in since the read, which is read again
  // as new changesets come (`refreshScopes`: the changeset lists refresh on check-ins, the user's and others').
  const olderThanRead = recent.length >= readLimit && id < Math.min(...recent.map((changeset) => changeset.id));
  return olderThanRead ? { id } : { id, missing: true };
}

/** What to try when nothing shows: the filters only look through what the time range read. */
export function noChangesetsHint(since: SincePreset, filtering: boolean): string {
  const longerRange = longerRangeHint(since, filtering);
  if (longerRange) return longerRange;
  return filtering ? `Any time reads the newest ${formatCount(ANY_TIME_LIMIT)} changesets.` : 'Nothing was checked in yet.';
}

/** What the header says instead of a bare count once Any time stopped at its cap; undefined while the count tells it all. */
export function changesetsCap(shown: number, read: number, since: SincePreset): string | undefined {
  if (since !== 'anyTime' || read < ANY_TIME_LIMIT) return undefined;
  const newest = `newest ${formatCount(ANY_TIME_LIMIT)}`;
  return shown === read ? `The ${newest}` : `${formatCount(shown)} shown of the ${newest}`;
}
