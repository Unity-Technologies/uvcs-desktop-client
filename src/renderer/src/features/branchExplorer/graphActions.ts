import type { MergeKind } from '@shared/domain/merge';
import { navigation } from '../../app/navigation/navigationStore';
import { diffBranch } from '../branches/branchOperations';
import { showLabelChanges } from '../labels/labelOperations';
import type { GraphSelection } from './graphSelection';
import { selectedLabel } from './model/graphLabels';
import type { GraphLayout } from './model/layoutGraph';

/** Operations the Branch Explorer's keys start; each one delegates to the view or flow that owns it. */
export const graphActions = {
  merge: (kind: MergeKind, sourceSpec: string) => navigation.openPage({ kind: 'merge', request: { kind, sourceSpec } }),

  diffChangeset: (id: number) => navigation.openPage({ kind: 'diff', title: `Changeset ${id}`, target: { kind: 'changeset', changesetId: id } }),
  diffBranch,
  diffLabel: showLabelChanges,
};

/**
 * What Enter and a double-click open: a label's changes when the selection came from its chip, a changeset's or a
 * branch's diff, and Changes for the pending changes.
 */
export function openSelection(layout: GraphLayout, selection: GraphSelection | null, repository: string): void {
  const label = selectedLabel(layout, selection, repository);
  if (label) return graphActions.diffLabel(label);
  switch (selection?.kind) {
    case 'changeset':
      return graphActions.diffChangeset(selection.id);
    case 'pending':
      return navigation.goToView('changes');
    case 'branch': {
      const lane = layout.lanesByBranch.get(selection.name);
      if (lane) graphActions.diffBranch(lane.branch);
    }
  }
}
