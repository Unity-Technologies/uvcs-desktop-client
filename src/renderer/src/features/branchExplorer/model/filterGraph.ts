import type { BranchExplorerData, GraphBranch } from '@shared/domain/branchExplorer';

export interface GraphFilter {
  /** Only this branch, its ancestors, its descendants and the branches merged to or from them. */
  relatedTo: string | null;
  /** Hide branches whose last changeset was already merged somewhere else. */
  hideMergedBranches: boolean;
  /** The workspace branch is never hidden by the filters. */
  currentBranch: string | null;
}

export function filterGraph(data: BranchExplorerData, filter: GraphFilter): BranchExplorerData {
  let visible = new Set(data.branches.map((branch) => branch.name));
  if (filter.relatedTo) visible = relatedBranches(data, filter.relatedTo);
  if (filter.hideMergedBranches) {
    const merged = mergedBranches(data);
    visible = new Set([...visible].filter((name) => !merged.has(name) || name === filter.currentBranch));
  }
  return keepBranches(data, visible);
}

/** Branches whose most recent loaded changeset is the source of a merge (other than `/main`). */
export function mergedBranches(data: BranchExplorerData): Set<string> {
  const mergeSources = new Set(
    data.mergeLinks.filter((link) => link.type === 'merge' || link.type === 'interval').map((link) => link.sourceChangeset),
  );
  const lastChangesetOf = new Map<string, number>();
  for (const changeset of data.changesets) {
    lastChangesetOf.set(changeset.branch, Math.max(changeset.id, lastChangesetOf.get(changeset.branch) ?? -1));
  }
  return new Set(
    [...lastChangesetOf]
      .filter(([branch, last]) => branch !== '/main' && mergeSources.has(last))
      .map(([branch]) => branch),
  );
}

export function relatedBranches(data: BranchExplorerData, branchName: string): Set<string> {
  const byName = new Map(data.branches.map((branch) => [branch.name, branch]));
  const related = new Set([...ancestors(byName, branchName), ...descendants(data.branches, branchName)]);

  const branchOfChangeset = new Map(data.changesets.map((changeset) => [changeset.id, changeset.branch]));
  for (const link of data.mergeLinks) {
    const source = branchOfChangeset.get(link.sourceChangeset);
    const destination = branchOfChangeset.get(link.destinationChangeset);
    if (source === undefined || destination === undefined) continue;
    if (source === branchName) related.add(destination);
    if (destination === branchName) related.add(source);
  }
  return related;
}

function ancestors(byName: Map<string, GraphBranch>, branchName: string): string[] {
  const result: string[] = [];
  for (let current = byName.get(branchName); current; current = byName.get(current.parent)) result.push(current.name);
  return result;
}

function descendants(branches: GraphBranch[], branchName: string): string[] {
  return branches.filter((branch) => branch.name.startsWith(`${branchName}/`)).map((branch) => branch.name);
}

function keepBranches(data: BranchExplorerData, names: Set<string>): BranchExplorerData {
  const changesets = data.changesets.filter((changeset) => names.has(changeset.branch));
  const ids = new Set(changesets.map((changeset) => changeset.id));
  return {
    branches: data.branches.filter((branch) => names.has(branch.name)),
    changesets,
    mergeLinks: data.mergeLinks.filter((link) => ids.has(link.sourceChangeset) && ids.has(link.destinationChangeset)),
    labels: data.labels.filter((label) => ids.has(label.changeset)),
  };
}
