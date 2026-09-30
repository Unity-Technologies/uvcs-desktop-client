import type { ShelvedForUpdate, UpdateResolutions } from '@shared/domain/incoming';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import { readUpdateProgress } from '../cm/progress/updateProgress';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { UPDATE_ARGS } from '../cm/updateArgs';
import { toAbsolutePath } from '../files/workspacePaths';
import { readIncomingChanges } from '../merge/incoming';
import { unresolvedConflicts, updateMergingConflicts } from '../merge/updateWithMerge';
import type { OperationContext } from '../operations/OperationTracker';
import { shelvedContents } from './pendingSnapshot';
import { failureReason, putBackAfterFailure } from './putShelvedChangesBack';
import { readPendingSnapshot } from './readPendingChanges';
import { selectorObjectRef } from './selectorObjectRef';
import type { ShelveFlowDependencies } from './shelveFlowDependencies';
import { newShelveRecord, NO_TARGET } from './shelveRecord';
import { describeSelector } from './switchSelectors';
import { createAutomaticShelve } from './verifiedShelve';
import { readWorkspaceIdentity } from './workspaceIdentity';

/**
 * Updates past incoming changesets that deleted or moved files changed locally, which `cm update` can't merge:
 * 1. Shelve just those files with the automatic-shelve comment, check the shelve holds them, and record it like
 *    changes left on a switch, so Changes offers them back (restoring merges the shelve without any external tool).
 * 2. Undo them and update, writing the user's merge of the files changed on both sides (`resolutions`), unless some of
 *    those have none yet: Incoming then shows only them.
 * If the update fails, the files are put back.
 */
export async function shelveBlockedAndUpdate(
  deps: ShelveFlowDependencies,
  workspacePath: string,
  resolutions: UpdateResolutions | null,
  context: OperationContext,
): Promise<ShelvedForUpdate> {
  const { cm, records } = deps;
  const incoming = await readIncomingChanges(cm, workspacePath);
  if (incoming.blockedPaths.length === 0) throw new Error('Nothing blocks the update anymore: update from Incoming.');

  const workspace = await readWorkspaceIdentity(cm, workspacePath);
  const objectRef = await selectorObjectRef(cm, workspacePath, workspace.selector);
  if (!objectRef) throw new Error(`Couldn't find ${describeSelector(workspace.selector)} in the repository, so nothing was shelved.`);

  const snapshot = await readPendingSnapshot(cm, workspacePath);
  const blocked = new Set(incoming.blockedPaths);
  const changes = snapshot.changes.filter((change) => blocked.has(change.path));

  context.beginStep('Shelving the blocking files', 1, 2);
  const shelve = await createAutomaticShelve(cm, workspacePath, changes, objectRef, context, incoming.blockedPaths);
  const record = newShelveRecord(workspace, shelve.id, shelvedContents(snapshot, changes), { mode: 'leave', reason: 'update', objectRef, target: NO_TARGET });
  records.save(record);
  const result = { shelveId: shelve.id, count: record.paths.length };

  // From here on the changes live in the shelve: a failure puts them back.
  try {
    await cm.query(onLinksThemselves('undo', ...incoming.blockedPaths.map((path) => toAbsolutePath(workspacePath, path))), { cwd: workspacePath });
    if (unresolvedConflicts(incoming.conflicts, resolutions).length > 0) return { ...result, updated: false, backupDirectory: null };

    context.beginStep('Updating', 2, 2);
    if (incoming.conflicts.length > 0) {
      // The blocking files are undone: what came in, read before shelving, is all the update has to merge.
      return { ...result, updated: true, ...(await updateMergingConflicts(cm, workspacePath, incoming.conflicts, resolutions ?? {}, deps.backupsRoot, context)) };
    }
    await cm.execute(UPDATE_ARGS, { cwd: workspacePath, onOutputLine: context.progressOf(readUpdateProgress) });
    return { ...result, updated: true, backupDirectory: null };
  } catch (error) {
    throw await updateFailed(deps, workspacePath, record, error, context);
  }
}

/** Puts the shelved files back after a failed undo or update, and says where they are. */
async function updateFailed(deps: ShelveFlowDependencies, workspacePath: string, record: SwitchShelveRecord, cause: unknown, context: OperationContext): Promise<Error> {
  const failure = `Couldn't update: ${failureReason(cause)}`;
  if (await putBackAfterFailure(deps, workspacePath, record, context)) return new Error(`${failure}. Your changes were put back.`);
  return new Error(`${failure}. Your changes are safe in shelve ${record.shelveId}; restore them from Changes.`);
}
