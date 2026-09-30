import { MAIN_BRANCH_GUID } from '@shared/domain/branch';

/** As many as the official Desktop client lists in its branch popup. */
const MAX_RECENT_BRANCHES = 5;

/** The recent branches with this one first; /main is never among them, as the official client never lists it. */
export function withRecentBranch(recentGuids: readonly string[], branchGuid: string): string[] {
  const guid = branchGuid.toLowerCase();
  if (guid === MAIN_BRANCH_GUID) return [...recentGuids];
  return [guid, ...recentGuids.filter((other) => other !== guid)].slice(0, MAX_RECENT_BRANCHES);
}
