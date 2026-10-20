import type { Changeset } from '@shared/domain/changeset';
import type { QueryFilter } from '@shared/domain/query';
import type { Label } from '@shared/domain/label';
import { EVERYONE, pickedOwners } from '../../lib/peopleFilter';
import { longerRangeHint } from '../../lib/longerRangeHint';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { sinceDateFor, type SincePreset } from '../../lib/sincePresets';
import { formatCount } from '../../lib/text';
import { userFilterTexts } from '../../lib/userName';
import { isFiltering, type ViewFilters } from '../../lib/viewFilters';

/** Keeps "Any time" usable on huge repositories. */
const ANY_TIME_LIMIT = 2000;

/**
 * A branch picked by name, with the workspace it was picked in: the store outlives the workspace a window shows, and
 * another workspace's repository may have no such branch, or another one by that name.
 */
export interface PickedBranch {
  workspacePath: string;
  name: string;
}

export interface ChangesetFilters extends ViewFilters {
  since: SincePreset;
  /** Only the branch the workspace is on, following it as the workspace switches ("This branch"). */
  onlyCurrentBranch: boolean;
  /** Only this branch, kept for the session (`CHANGESET_SESSION_FILTERS`). At most one of the two is on. */
  pickedBranch: PickedBranch | null;
}

export const DEFAULT_CHANGESET_FILTERS: ChangesetFilters = { text: '', people: EVERYONE, since: 'lastMonth', onlyCurrentBranch: false, pickedBranch: null };

/** Every branch's changesets: what "Clear filters" resets besides the text and the people. */
export const ALL_BRANCHES: Pick<ChangesetFilters, 'onlyCurrentBranch' | 'pickedBranch'> = { onlyCurrentBranch: false, pickedBranch: null };
export const CLEARED_CHANGESET_FILTERS: Partial<ChangesetFilters> = ALL_BRANCHES;

/** Only the workspace's branch, whichever it is on. */
export const CURRENT_BRANCH: Pick<ChangesetFilters, 'onlyCurrentBranch' | 'pickedBranch'> = { onlyCurrentBranch: true, pickedBranch: null };

/** Only `name`'s changesets, in this workspace. */
export function pickedBranchFilters(workspacePath: string, name: string): Pick<ChangesetFilters, 'onlyCurrentBranch' | 'pickedBranch'> {
  return { onlyCurrentBranch: false, pickedBranch: { workspacePath, name } };
}

/** A branch picked by name is the repository's, so it is kept for the session, as the people picked by name are. */
export const CHANGESET_SESSION_FILTERS: (keyof ChangesetFilters)[] = ['pickedBranch'];

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
  if (pickedBranch?.workspacePath === workspacePath) return { kind: 'picked', name: pickedBranch.name };
  if (onlyCurrentBranch && currentBranch) return { kind: 'current', name: currentBranch };
  return { kind: 'all' };
}

/** The branch whose changesets the scope reads; undefined for every branch. */
export function branchOf(scope: BranchScope): string | undefined {
  return scope.kind === 'all' ? undefined : scope.name;
}

/** Whether "Clear filters" would show more: text, people, or a branch that applies here. */
export function isFilteringChangesets(filters: ChangesetFilters, scope: BranchScope): boolean {
  return isFiltering(filters) || scope.kind !== 'all';
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
