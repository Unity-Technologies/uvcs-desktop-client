import type { GraphBranch, GraphChangeset } from '@shared/domain/branchExplorer';

/**
 * Keeps the branches worth drawing: those with changesets in the loaded range, those created within it,
 * and every ancestor of them (so child lanes always hang from a visible parent).
 */
export function relevantBranches(branches: GraphBranch[], changesets: GraphChangeset[], sinceDate?: string): GraphBranch[] {
  const byName = new Map(branches.map((branch) => [branch.name, branch]));
  const since = sinceDate ? new Date(sinceDate).getTime() : Number.NEGATIVE_INFINITY;
  const kept = new Set<string>();

  const keepWithAncestors = (name: string): void => {
    let current = byName.get(name);
    while (current && !kept.has(current.name)) {
      kept.add(current.name);
      current = byName.get(current.parent);
    }
  };

  changesets.forEach((changeset) => keepWithAncestors(changeset.branch));
  branches.filter((branch) => new Date(branch.date).getTime() >= since).forEach((branch) => keepWithAncestors(branch.name));

  return branches.filter((branch) => kept.has(branch.name));
}
