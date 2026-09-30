import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import type { CmClient } from '../cm/CmClient';
import type { OperationContext } from '../operations/OperationTracker';
import type { LeftChangesFinder } from './leftChanges';
import { applyShelveCleanly } from './applyShelveCleanly';
import { changedPaths } from './pendingSnapshot';
import { putBack } from './privateBackups';
import { readPendingSnapshot } from './readPendingChanges';
import type { ShelveFlowDependencies } from './shelveFlowDependencies';

/**
 * Puts shelved changes back in the workspace they were shelved from, after a step that was taking them out of it
 * failed (undoing them, switching, updating). Changes the failed step never undid are still pending: there is nothing
 * to bring back, and `cm` would refuse to merge the shelve into a workspace with pending changes. Otherwise the files
 * moved aside go back and the shelve is merged when it applies cleanly. Resolves to whether the changes are in the
 * workspace again; then the shelve and its record are gone (`LeftChangesFinder.finish`).
 */
export async function putShelvedChangesBack(
  cm: CmClient,
  leftChanges: LeftChangesFinder,
  workspacePath: string,
  record: SwitchShelveRecord,
  context: OperationContext,
): Promise<boolean> {
  if (record.backup) await putBack(workspacePath, record.backup);
  if (!(await allStillPending(cm, workspacePath, record.paths))) {
    const outcome = await applyShelveCleanly(cm, workspacePath, record.shelveId, context);
    if (outcome.kind !== 'applied') return false;
  }
  await leftChanges.finish(workspacePath, record);
  return true;
}

/**
 * `putShelvedChangesBack` once a step failed. It never fails itself: whatever goes wrong putting them back, the changes
 * are still safe in the shelve, and the caller's error says so.
 */
export async function putBackAfterFailure(
  { cm, leftChanges }: Pick<ShelveFlowDependencies, 'cm' | 'leftChanges'>,
  workspacePath: string,
  record: SwitchShelveRecord,
  context: OperationContext,
): Promise<boolean> {
  try {
    return await putShelvedChangesBack(cm, leftChanges, workspacePath, record, context);
  } catch {
    return false;
  }
}

/** What went wrong, without its final period, for the sentence that goes on to say where the changes are. */
export function failureReason(cause: unknown): string {
  return (cause instanceof Error ? cause.message : String(cause)).replace(/\.$/, '');
}

async function allStillPending(cm: CmClient, workspacePath: string, paths: string[]): Promise<boolean> {
  const pending = new Set(changedPaths((await readPendingSnapshot(cm, workspacePath)).changes));
  return paths.length > 0 && paths.every((path) => pending.has(path));
}
