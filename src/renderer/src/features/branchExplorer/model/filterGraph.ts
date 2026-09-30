import type { BranchExplorerData, GraphBranch } from '@shared/domain/branchExplorer';

/** Branches within `hops` fork or merge connections of `branch`; see `relatedBranches`. */
export interface GraphFocus {
  branch: string;
  hops: number;
}

export interface GraphFilter {
  /** Only the branches related to one. */
  focus: GraphFocus | null;
  /** Only these branches; null shows them all. */
  visibleBranches: ReadonlySet<string> | null;
  /** Hide branches whose last changeset was already merged somewhere else. */
  hideMergedBranches: boolean;
  /** The workspace branch is never hidden by the filters. */
  currentBranch: string | null;
}

export function filterGraph(data: BranchExplorerData, filter: GraphFilter): BranchExplorerData {
  let visible = new Set(data.branches.map((branch) => branch.name));
  if (filter.focus) visible = relatedBranches(data, filter.focus.branch, filter.focus.hops);
  if (filter.visibleBranches) {
    const chosen = filter.visibleBranches;
    visible = new Set([...visible].filter((name) => chosen.has(name)));
  }
  if (filter.hideMergedBranches) {
    const merged = mergedBranches(data);
    visible = new Set([...visible].filter((name) => !merged.has(name) || name === filter.currentBranch));
  }
  return keepBranches(data, visible);
}

/** Branches whose most recent loaded changeset is the source of a merge (other than `/main`). */
function mergedBranches(data: BranchExplorerData): Set<string> {
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

/**
 * The branch, plus every branch within `hops` connections of it: one hop is a branch it forked from
 * or that forked from it, or one it merged with (Plastic's "related branches"); two hops add their
 * relatives, and so on. The branch's ancestors always stay, so the focus keeps its way back to `/main`.
 */
export function relatedBranches(data: BranchExplorerData, branchName: string, hops = 1): Set<string> {
  const adjacency = new Map<string, Set<string>>();
  const connect = (a: string, b: string): void => {
    if (a === b) return;
    for (const [from, to] of [[a, b], [b, a]] as const) {
      const peers = adjacency.get(from);
      if (peers) peers.add(to);
      else adjacency.set(from, new Set([to]));
    }
  };
  const names = new Set(data.branches.map((branch) => branch.name));
  for (const branch of data.branches) if (names.has(branch.parent)) connect(branch.name, branch.parent);
  const branchOfChangeset = new Map(data.changesets.map((changeset) => [changeset.id, changeset.branch]));
  for (const link of data.mergeLinks) {
    const source = branchOfChangeset.get(link.sourceChangeset);
    const destination = branchOfChangeset.get(link.destinationChangeset);
    if (source !== undefined && destination !== undefined) connect(source, destination);
  }

  const byName = new Map(data.branches.map((branch) => [branch.name, branch]));
  const related = new Set([branchName, ...ancestors(byName, branchName)]);
  const queue = [{ name: branchName, depth: 0 }];
  const visited = new Set([branchName]);
  for (let index = 0; index < queue.length; index++) {
    const { name, depth } = queue[index]!;
    related.add(name);
    if (depth === hops) continue;
    for (const next of adjacency.get(name) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({ name: next, depth: depth + 1 });
    }
  }
  return related;
}

function ancestors(byName: Map<string, GraphBranch>, branchName: string): string[] {
  const result: string[] = [];
  for (let current = byName.get(byName.get(branchName)?.parent ?? ''); current; current = byName.get(current.parent)) result.push(current.name);
  return result;
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
