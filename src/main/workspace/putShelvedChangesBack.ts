import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import type { CmClient } from '../cm/CmClient';
import type { OperationContext } from '../operations/OperationTracker';
import type { LeftChangesFinder } from './leftChanges';
import { changedPaths } from './pendingSnapshot';
import { putBack } from './privateBackups';
import { readPendingSnapshot } from './readPendingChanges';
import { applyShelveCleanly } from './applyShelveCleanly';

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

async function allStillPending(cm: CmClient, workspacePath: string, paths: string[]): Promise<boolean> {
  const pending = new Set(changedPaths((await readPendingSnapshot(cm, workspacePath)).changes));
  return paths.length > 0 && paths.every((path) => pending.has(path));
}
