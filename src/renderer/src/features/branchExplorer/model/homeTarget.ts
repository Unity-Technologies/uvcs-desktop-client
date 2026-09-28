import type { GraphSelection } from '../graphSelection';
import type { GraphLayout } from './layoutGraph';

/**
 * Where "Go home" (and the first view of the graph) goes: where the home badge is. The pending changes when there are
 * some (the badge is on them), else the loaded changeset, unless the workspace's branch has no changesets of its own
 * yet: then its band, which starts from the loaded changeset on the parent branch, is where the workspace is.
 * Null when neither is in the graph.
 */
export function homeTarget(layout: GraphLayout, homeChangeset: number | null, workspaceBranch: string | null): GraphSelection | null {
  if (layout.pending) return { kind: 'pending' };
  const lane = workspaceBranch !== null ? layout.lanesByBranch.get(workspaceBranch) : undefined;
  if (lane && lane.firstOwnColumn === null && lane.baseChangeset === homeChangeset) return { kind: 'branch', name: lane.branch.name };
  return homeChangeset !== null && layout.nodes.has(homeChangeset) ? { kind: 'changeset', id: homeChangeset } : null;
}
