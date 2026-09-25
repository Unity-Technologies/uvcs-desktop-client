import type { Branch } from '@shared/domain/branch';
import type { BranchGroup } from './BranchSearchList';

/**
 * The branch switcher's groups: the top-level branches, the recently used ones, then all the rest by name.
 * Each branch shows once, in the first group it belongs to, so the arrow keys never visit it twice.
 */
export function branchSwitcherGroups(branches: Branch[], recentNames: string[]): BranchGroup[] {
  const byName = new Map(branches.map((branch) => [branch.name, branch]));
  const main = branches.filter((branch) => !branch.parent);
  const shown = new Set(main.map((branch) => branch.name));

  const recent = recentNames.flatMap((name) => {
    const branch = byName.get(name);
    if (!branch || shown.has(name)) return [];
    shown.add(name);
    return [branch];
  });
  const others = branches.filter((branch) => !shown.has(branch.name)).sort((a, b) => a.name.localeCompare(b.name));

  return [
    { title: main.length === 1 ? 'Main branch' : 'Top-level branches', branches: main },
    { title: 'Recent', branches: recent },
    { title: main.length + recent.length > 0 ? 'Other branches' : 'All branches', branches: others },
  ];
}
