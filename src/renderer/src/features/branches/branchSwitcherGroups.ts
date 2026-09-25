import { MAIN_BRANCH_GUID, type Branch } from '@shared/domain/branch';
import type { BranchGroup } from './branchSearchRows';

/**
 * The branch switcher's groups, as the official Desktop client classifies them: /main (the repository's well-known
 * main branch GUID), the workspace's recent branches in the order they were switched to, then every other branch,
 * newest first by creation date. Each branch shows once, so the arrow keys never visit it twice.
 */
export function branchSwitcherGroups(branches: Branch[], recentGuids: string[]): BranchGroup[] {
  const newestFirst = branches
    .map((branch) => ({ branch, created: Date.parse(branch.date) }))
    .sort((a, b) => (b.created || 0) - (a.created || 0))
    .map(({ branch }) => branch);
  const byGuid = new Map(newestFirst.map((branch) => [branch.guid.toLowerCase(), branch]));

  const main = byGuid.get(MAIN_BRANCH_GUID);
  const shown = new Set([MAIN_BRANCH_GUID]);
  const recent = recentGuids.flatMap((guid) => {
    const branch = byGuid.get(guid.toLowerCase());
    if (!branch || shown.has(guid.toLowerCase())) return [];
    shown.add(guid.toLowerCase());
    return [branch];
  });
  const others = newestFirst.filter((branch) => !shown.has(branch.guid.toLowerCase()));

  return [
    { title: 'Main branch', branches: main ? [main] : [] },
    { title: 'Recent branches', branches: recent },
    { title: 'Other branches', branches: others },
  ];
}
