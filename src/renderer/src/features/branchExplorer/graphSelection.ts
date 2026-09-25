import type { GraphTarget } from './canvas/graphTargets';

/** What the details panel shows. Labels and merge links select the changeset they point to. */
export type GraphSelection = { kind: 'changeset'; id: number } | { kind: 'branch'; name: string };

export function selectionFor(target: GraphTarget | null): GraphSelection | null {
  switch (target?.kind) {
    case 'changeset':
      return { kind: 'changeset', id: target.id };
    case 'label':
      return { kind: 'changeset', id: target.label.changeset };
    case 'mergeLink':
      return { kind: 'changeset', id: target.link.destinationChangeset };
    case 'branch':
      return { kind: 'branch', name: target.lane.branch.name };
    default:
      return null;
  }
}
