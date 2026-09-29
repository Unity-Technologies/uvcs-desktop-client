import type { MergeKind } from '@shared/domain/merge';
import { navigation } from '../../app/navigation/navigationStore';
import { diffBranch } from '../branches/branchOperations';
import { showLabelChanges } from '../labels/labelOperations';

/** Operations the Branch Explorer's keys start; each one delegates to the view or flow that owns it. */
export const graphActions = {
  merge: (kind: MergeKind, sourceSpec: string) => navigation.openPage({ kind: 'merge', request: { kind, sourceSpec } }),

  diffChangeset: (id: number) => navigation.openPage({ kind: 'diff', title: `Changeset ${id}`, target: { kind: 'changeset', changesetId: id } }),
  diffBranch,
  diffLabel: showLabelChanges,
};
