import type { Changeset } from '@shared/domain/changeset';
import type { QueryFilter } from '@shared/domain/query';
import { shortBranchName } from '@shared/domain/specs';
import type { Label } from '@shared/domain/label';
import { EVERYONE, pickedOwners } from '../../lib/peopleFilter';
import { longerRangeHint } from '../../lib/longerRangeHint';
import { typedChangesetNumber } from '../../lib/changesetNumber';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { sinceDateFor, type SincePreset } from '../../lib/sincePresets';
import { firstLine, formatCount } from '../../lib/text';
import { userFilterTexts } from '../../lib/userName';
import type { ViewFilters } from '../../lib/viewFilters';

/** Keeps "Any time" usable on huge repositories. */
const ANY_TIME_LIMIT = 2000;

export interface ChangesetFilters extends ViewFilters {
  since: SincePreset;
  onlyCurrentBranch: boolean;
}

export const DEFAULT_CHANGESET_FILTERS: ChangesetFilters = { text: '', people: EVERYONE, since: 'lastMonth', onlyCurrentBranch: false };

/** What "Clear filters" resets besides the text and the people. */
export const CLEARED_CHANGESET_FILTERS: Partial<ChangesetFilters> = { onlyCurrentBranch: false };

/**
 * What to ask `cm find` for: the time range, the people and the branch, so "Any time" (capped) finds the people's
 * newest ones and not those among everyone's newest. The text is matched locally, so typing stays instant.
 */
export function toQueryFilter({ since, people, onlyCurrentBranch }: Omit<ChangesetFilters, 'text'>, currentBranch: string | undefined, today: Date): QueryFilter {
  return {
    sinceDate: sinceDateFor(since, today),
    owners: pickedOwners(people),
    branch: onlyCurrentBranch ? currentBranch : undefined,
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
 * (older or newer than those read); or, `missing`, a number typed that names no changeset, offered but not picked.
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
  const ids = recent.map((changeset) => changeset.id);
  // Checked in since the read, or older than a read that stopped at its limit.
  const beyondRead = id > Math.max(...ids) || (recent.length >= readLimit && id < Math.min(...ids));
  return beyondRead ? { id } : { id, missing: true };
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
