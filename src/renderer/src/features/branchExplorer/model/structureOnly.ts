import type { BranchExplorerData, GraphChangeset } from '@shared/domain/branchExplorer';

/** A changeset to draw, or a "+N" node standing for a linear run of changesets collapsed by "Only relevant changesets". */
export interface ShownChangeset {
  /** The changeset itself; for a collapsed run, its first changeset. */
  changeset: GraphChangeset;
  /** Every changeset of a collapsed run, oldest first; null for a plain changeset. */
  collapsed: readonly GraphChangeset[] | null;
}

/** Runs shorter than this stay as they are: a "+1" node would save nothing. */
const MIN_RUN = 2;

/**
 * The changesets that shape the diagram: where each branch starts (its base and first changeset) and
 * ends, both ends of every merge, and every labeled changeset. Mirrors classic Plastic's "only relevant".
 */
export function structuralChangesets(data: BranchExplorerData): Set<number> {
  const structural = new Set<number>();
  for (const branch of data.branches) structural.add(branch.headChangeset);
  for (const link of data.mergeLinks) {
    structural.add(link.sourceChangeset);
    structural.add(link.destinationChangeset);
  }
  for (const label of data.labels) structural.add(label.changeset);

  const firstAndLast = new Map<string, [GraphChangeset, GraphChangeset]>();
  for (const changeset of data.changesets) {
    const ends = firstAndLast.get(changeset.branch);
    if (!ends) firstAndLast.set(changeset.branch, [changeset, changeset]);
    else if (changeset.id < ends[0].id) ends[0] = changeset;
    else if (changeset.id > ends[1].id) ends[1] = changeset;
  }
  for (const [first, last] of firstAndLast.values()) {
    structural.add(first.id);
    structural.add(first.parent);
    structural.add(last.id);
  }
  return structural;
}

/**
 * Changesets in id order, with each branch's linear runs of changesets outside `keep` folded into
 * one node at the position of the run's first changeset. Branches are linear, so a run never has
 * anything branching off or merging into its middle once the structural changesets are kept.
 */
export function collapseLinearRuns(sortedChangesets: readonly GraphChangeset[], keep: ReadonlySet<number>): ShownChangeset[] {
  const runOf = new Map<number, GraphChangeset[]>();
  const pendingByBranch = new Map<string, GraphChangeset[]>();
  const closeRun = (branch: string): void => {
    const run = pendingByBranch.get(branch);
    pendingByBranch.delete(branch);
    if (run && run.length >= MIN_RUN) for (const changeset of run) runOf.set(changeset.id, run);
  };

  for (const changeset of sortedChangesets) {
    if (keep.has(changeset.id)) {
      closeRun(changeset.branch);
      continue;
    }
    const pending = pendingByBranch.get(changeset.branch);
    if (pending) pending.push(changeset);
    else pendingByBranch.set(changeset.branch, [changeset]);
  }
  for (const branch of [...pendingByBranch.keys()]) closeRun(branch);

  return sortedChangesets.flatMap((changeset): ShownChangeset[] => {
    const run = runOf.get(changeset.id);
    if (!run) return [{ changeset, collapsed: null }];
    return run[0] === changeset ? [{ changeset, collapsed: run }] : [];
  });
}
