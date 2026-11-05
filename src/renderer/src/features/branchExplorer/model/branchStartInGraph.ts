import type { BranchStart } from '@shared/domain/branch';
import type { GraphLayout } from './layoutGraph';

/**
 * Where `branch` starts, from the history the Branch Explorer read, with no command: its first changeset there, when
 * that one's parent is on another branch, or is the root. Null when the history doesn't tell: the branch has no
 * changeset in it, or its first one there has a parent the date range left out (an older changeset of the branch, or
 * its base). The first changeset and its parent are kept out of "+N" nodes (`structuralChangesets`), and a "+N" node
 * holds one branch's changesets, so the layout tells it as well as the history.
 */
export function branchStartInGraph(layout: GraphLayout, branch: string): BranchStart | null {
  const column = layout.lanesByBranch.get(branch)?.firstOwnColumn;
  const first = column === null || column === undefined ? undefined : layout.nodesByColumn[column]?.changeset;
  if (!first || first.branch !== branch) return null;
  if (first.parent < 0) return { firstChangeset: first.id, base: first.parent };
  const parentBranch = layout.nodes.get(first.parent)?.changeset.branch;
  return parentBranch !== undefined && parentBranch !== branch ? { firstChangeset: first.id, base: first.parent } : null;
}
