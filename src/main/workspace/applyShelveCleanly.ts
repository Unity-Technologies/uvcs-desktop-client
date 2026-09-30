import type { MergeRequest } from '@shared/domain/merge';
import { spec } from '@shared/domain/specs';
import type { CmClient } from '../cm/CmClient';
import { previewMerge } from '../merge/previewMerge';
import { runMerge } from '../merge/runMerge';
import type { OperationContext } from '../operations/OperationTracker';

/** `applied` counts the changes merged: none when the workspace already had them. */
export type ApplyOutcome = { kind: 'applied'; count: number } | { kind: 'conflicts'; count: number } | { kind: 'pendingChanges' };

/**
 * Applies a shelve as a merge from it (never `cm shelveset apply`, which opens the merge tool on conflicts),
 * only when nothing conflicts. Conflicts are left for the merge view.
 */
export async function applyShelveCleanly(cm: CmClient, workspacePath: string, shelveId: number, context: OperationContext): Promise<ApplyOutcome> {
  const request: MergeRequest = { kind: 'merge', sourceSpec: spec.shelve(shelveId) };
  const plan = await previewMerge(cm, workspacePath, request);
  if (plan.status === 'pendingChanges') return { kind: 'pendingChanges' };
  if (plan.status !== 'ready') return { kind: 'applied', count: 0 };

  const conflictCount = plan.fileConflicts.length + plan.directoryConflicts.length;
  if (conflictCount > 0) return { kind: 'conflicts', count: conflictCount };

  await runMerge(cm, workspacePath, request, { directoryConflicts: [], files: {} }, context);
  return { kind: 'applied', count: plan.changes.length };
}
