import type { GraphTarget } from './canvas/graphTargets';

/**
 * What the details panel shows. Labels and merge links select the changeset they point to; merges in progress, where
 * they come from. The workspace's pending changes are selected as the changeset they will become.
 */
export type GraphSelection = { kind: 'changeset'; id: number } | { kind: 'branch'; name: string } | { kind: 'pending' };

export function selectionFor(target: GraphTarget | null): GraphSelection | null {
  switch (target?.kind) {
    case 'changeset':
      return { kind: 'changeset', id: target.id };
    case 'label':
      return { kind: 'changeset', id: target.label.changeset };
    case 'mergeLink':
      return { kind: 'changeset', id: target.link.destinationChangeset };
    case 'pendingMergeLink':
      return { kind: 'changeset', id: target.link.sourceChangeset };
    case 'branch':
      return { kind: 'branch', name: target.lane.branch.name };
    case 'pending':
      return { kind: 'pending' };
    default:
      return null;
  }
}
