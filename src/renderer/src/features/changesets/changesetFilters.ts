import type { Changeset } from '@shared/domain/changeset';
import type { QueryFilter } from '@shared/domain/query';
import type { Label } from '@shared/domain/label';
import { EVERYONE, pickedOwners } from '../../lib/peopleFilter';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { sinceDateFor, type SincePreset } from '../../lib/sincePresets';
import { formatCount } from '../../lib/text';
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

/** What to try when nothing shows: the filters only look through what the time range read. */
export function noChangesetsHint(since: SincePreset, filtering: boolean): string {
  if (since !== 'anyTime') return filtering ? 'The filters look within the time range. Try a longer one.' : 'Try a longer time range.';
  return filtering ? `Any time reads the newest ${formatCount(ANY_TIME_LIMIT)} changesets.` : 'Nothing was checked in yet.';
}

/** What the header says instead of a bare count once Any time stopped at its cap; undefined while the count tells it all. */
export function changesetsCap(shown: number, read: number, since: SincePreset): string | undefined {
  if (since !== 'anyTime' || read < ANY_TIME_LIMIT) return undefined;
  const newest = `newest ${formatCount(ANY_TIME_LIMIT)}`;
  return shown === read ? `The ${newest}` : `${formatCount(shown)} shown of the ${newest}`;
}
