import type { ShelvedForUpdate, UpdateResolutions } from '@shared/domain/incoming';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import type { CmClient } from '../cm/CmClient';
import { parsePendingChanges } from '../cm/pendingChangesXml';
import { readUpdateProgress } from '../cm/progress/updateProgress';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { UPDATE_ARGS } from '../cm/updateArgs';
import { toAbsolutePath } from '../files/workspacePaths';
import { readIncomingChanges } from '../merge/incoming';
import { unresolvedConflicts, updateWithMerge } from '../merge/updateWithMerge';
import type { OperationContext } from '../operations/OperationTracker';
import type { LeftChangesFinder } from './leftChanges';
import { changedPaths, shelvedChangelists, SWITCH_STATUS_ARGS } from './pendingSnapshot';
import { selectorObjectRef } from './selectorObjectRef';
import { selectorSpec } from '@shared/domain/specs';
import { describeSelector } from './switchSelectors';
import type { SwitchShelveRecords } from './switchShelveRecords';
import { applyShelveCleanly, createSwitchShelve } from './switchShelves';
import { readWorkspaceIdentity } from './workspaceIdentity';

export interface ShelveForUpdateDependencies {
  cm: CmClient;
  records: SwitchShelveRecords;
  leftChanges: LeftChangesFinder;
  /** Where updating with merged files saves the local versions (`updateWithMerge`). */
  backupsRoot: string;
}

/**
 * Updates past incoming changesets that deleted or moved files changed locally, which `cm update` can't merge:
 * 1. Shelve just those files with the automatic-shelve comment, check the shelve holds them, and record it like
 *    changes left on a switch, so Changes offers them back (restoring merges the shelve without any external tool).
 * 2. Undo them and update, writing the user's merge of the files changed on both sides (`resolutions`), unless some of
 *    those have none yet: Incoming then shows only them.
 * If the update fails, the files are put back.
 */
export async function shelveBlockedAndUpdate(
  deps: ShelveForUpdateDependencies,
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

  const snapshot = parsePendingChanges(await cm.query(SWITCH_STATUS_ARGS, { cwd: workspacePath }));
  const blocked = new Set(incoming.blockedPaths);
  const changes = snapshot.changes.filter((change) => blocked.has(change.path));

  context.beginStep('Shelving the blocking files', 1, 2);
  const shelve = await createSwitchShelve(cm, workspacePath, changes, objectRef, context, incoming.blockedPaths);
  const record: SwitchShelveRecord = {
    workspaceGuid: workspace.guid,
    shelveId: shelve.id,
    repository: workspace.repository,
    source: { spec: selectorSpec(workspace.selector), name: describeSelector(workspace.selector), objectRef },
    target: { spec: '', name: '' },
    mode: 'leave',
    reason: 'update',
    createdAt: new Date().toISOString(),
    paths: changedPaths(changes),
    changelists: shelvedChangelists({ ...snapshot, changes }),
  };
  records.save(record);
  const result = { shelveId: shelve.id, count: record.paths.length };

  // From here on the changes live in the shelve: a failure puts them back.
  try {
    await cm.query(onLinksThemselves('undo', ...incoming.blockedPaths.map((path) => toAbsolutePath(workspacePath, path))), { cwd: workspacePath });
    if (unresolvedConflicts(incoming.conflicts, resolutions).length > 0) return { ...result, updated: false, backupDirectory: null };

    context.beginStep('Updating', 2, 2);
    if (incoming.conflicts.length > 0) return { ...result, updated: true, ...(await updateWithMerge(cm, workspacePath, resolutions!, deps.backupsRoot, context)) };
    await cm.execute(UPDATE_ARGS, { cwd: workspacePath, onOutputLine: context.progressOf(readUpdateProgress) });
    return { ...result, updated: true, backupDirectory: null };
  } catch (error) {
    throw await putBack(deps, workspacePath, record, error, context);
  }
}

async function putBack(deps: ShelveForUpdateDependencies, workspacePath: string, record: SwitchShelveRecord, cause: unknown, context: OperationContext): Promise<Error> {
  const reason = (cause instanceof Error ? cause.message : String(cause)).replace(/\.$/, '');
  try {
    const outcome = await applyShelveCleanly(deps.cm, workspacePath, record.shelveId, context);
    if (outcome.kind === 'applied') {
      await deps.leftChanges.finish(workspacePath, record);
      return new Error(`Couldn't update: ${reason}. Your changes were put back.`);
    }
  } catch {
    // Reported below: the changes are still safe in the shelve.
  }
  return new Error(`Couldn't update: ${reason}. Your changes are safe in shelve ${record.shelveId}; restore them from Changes.`);
}
