import type { GraphBranch } from '@shared/domain/branchExplorer';
import type { Label } from '@shared/domain/label';
import type { GraphSelection } from '../graphSelection';
import { selectedLabel } from './graphLabels';
import type { GraphLayout } from './layoutGraph';

/** What the Branch Explorer's selection shows in a page window following it: the changes of a label, changeset or branch. */
export type FollowedObject = { kind: 'label'; label: Pick<Label, 'name' | 'changeset'> } | { kind: 'changeset'; id: number } | { kind: 'branch'; branch: GraphBranch };

/**
 * The object selected in the graph, as a following page window shows it (`useShowInFollowingWindow`), whether the
 * details show or not: none for the pending changes or a selection the graph no longer draws.
 */
export function followedObject(layout: GraphLayout, selection: GraphSelection | null, repository: string): FollowedObject | null {
  const label = selectedLabel(layout, selection, repository);
  if (label) return { kind: 'label', label };
  if (selection?.kind === 'changeset') return layout.nodes.has(selection.id) ? { kind: 'changeset', id: selection.id } : null;
  if (selection?.kind === 'branch') {
    const lane = layout.lanesByBranch.get(selection.name);
    return lane ? { kind: 'branch', branch: lane.branch } : null;
  }
  return null;
}
