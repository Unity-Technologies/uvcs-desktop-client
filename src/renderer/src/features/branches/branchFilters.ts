import type { Branch } from '@shared/domain/branch';
import type { QueryFilter } from '@shared/domain/query';
import { matchesWordFilter } from '../../lib/matchesAllWords';
import { pickedOwners, type PeoplePick } from '../../lib/peopleFilter';
import { sinceDateFor, type SincePreset } from '../../lib/sincePresets';
import { userFilterTexts } from '../../lib/userName';

interface BranchesQueryFilters {
  since: SincePreset;
  /** The people picked, once picking paused (`PICKING_PAUSE_MS`). */
  people: PeoplePick;
  showHidden: boolean;
}

/** What Branches asks `cm find branch` for: the time range, the people picked and the hidden ones; the text is matched locally. */
export function branchesQuery({ since, people, showHidden }: BranchesQueryFilters, today = new Date()): QueryFilter {
  return { sinceDate: sinceDateFor(since, today), owners: pickedOwners(people), includeHidden: showHidden };
}

/** The branches by the people picked (`isPicked`) whose name, comment or creator has every word typed. */
export function filterBranches(branches: Branch[], search: string, isPicked: (owner: string) => boolean): Branch[] {
  return branches.filter((branch) => isPicked(branch.owner) && matchesWordFilter(branchFilterTexts(branch), search));
}

/** What a branch's row shows, which the Branches view's filter looks through, and the `br:` suggestions too. */
export function branchFilterTexts(branch: Pick<Branch, 'name' | 'comment' | 'owner'>): string[] {
  return [branch.name, branch.comment, ...userFilterTexts(branch.owner)];
}
