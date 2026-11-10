import { selectorSpec } from '@shared/domain/specs';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { readWorkspaceLoad } from '../cm/workspaceStatus';
import type { OperationContext } from '../operations/OperationTracker';
import { failureReason, putBackAfterFailure } from './putShelvedChangesBack';
import { runSwitch } from './runSwitch';
import type { ShelveFlowDependencies } from './shelveFlowDependencies';

/**
 * Puts the changes back where they were made after a switch with changes failed: the workspace back on the source when
 * the switch moved it halfway, the files moved aside, then the shelve merged back. If that isn't possible the record
 * stays, left on the source, so the changes are offered for restore there. Resolves to the error that says which.
 */
export async function rollBackSwitch(deps: ShelveFlowDependencies, workspacePath: string, record: SwitchShelveRecord, cause: unknown, context: OperationContext): Promise<Error> {
  const reason = failureReason(cause);
  // Whatever fails from here, the changes are still safe in the shelve: the error says where.
  const onSource = await returnToSource(deps, workspacePath, record.source.spec, context).catch(() => false);
  if (onSource && (await putBackAfterFailure(deps, workspacePath, record, context))) {
    return new Error(`${reason}. Your changes were put back.`);
  }
  deps.records.save({ ...record, mode: 'leave' });
  const restoreFrom = onSource ? 'restore them from Changes' : `switch back to ${record.source.name} to restore them`;
  return new Error(`${reason}. Your changes are safe in shelve ${record.shelveId}; ${restoreFrom}.`);
}

/**
 * A switch that fails halfway has already moved the workspace to the target, some files updated and others not: it
 * goes back (nothing is pending by then). Resolves to whether the workspace is on the source.
 */
async function returnToSource(deps: ShelveFlowDependencies, workspacePath: string, sourceSpec: string, context: OperationContext): Promise<boolean> {
  const { cm } = deps;
  const isOnSource = async (): Promise<boolean> => selectorSpec((await readWorkspaceLoad(cm, workspacePath)).selector) === sourceSpec;
  if (await isOnSource()) return true;
  await runSwitch(cm, workspacePath, sourceSpec, await deps.kindOf(workspacePath), context);
  return isOnSource();
}
