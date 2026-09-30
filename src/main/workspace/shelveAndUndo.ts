import type { PendingChange } from '@shared/domain/pendingChanges';
import type { ShelvedAway } from '@shared/domain/shelve';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import type { CmClient } from '../cm/CmClient';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { toAbsolutePath } from '../files/workspacePaths';
import type { OperationContext } from '../operations/OperationTracker';
import type { LeftChangesFinder } from './leftChanges';
import { moveNewItemsAside } from './moveNewItemsAside';
import { shelvedContents } from './pendingSnapshot';
import { failureReason, putBackAfterFailure } from './putShelvedChangesBack';
import { readPendingSnapshot } from './readPendingChanges';
import { newShelveRecord, NO_TARGET } from './shelveRecord';
import type { SwitchShelveRecords } from './switchShelveRecords';
import { createVerifiedShelve } from './verifiedShelve';
import { readWorkspaceIdentity } from './workspaceIdentity';

const IN_MERGE = "A merge in progress can't be shelved away. Check it in or undo it first, or shelve and keep the changes.";

export interface ShelveAndUndoDependencies {
  cm: CmClient;
  records: SwitchShelveRecords;
  leftChanges: LeftChangesFinder;
  /** Where the files the changes added wait while the shelve holds them. */
  backupsRoot: string;
}

/**
 * Shelves changes away, as switching leaves them (`switchWithChanges`), so they are only in the shelve:
 * 1. Shelve them with the user's comment and check the shelve holds them all (otherwise nothing is undone).
 * 2. Record the shelve (`reason: 'shelve'`: not offered as left changes), undo the changes, and move the files they
 *    added, now private, aside. Applying the shelve puts those and the changelists back (`LeftChangesFinder.apply`).
 * If undoing fails, the changes are put back.
 */
export async function shelveAndUndo(
  deps: ShelveAndUndoDependencies,
  workspacePath: string,
  paths: string[] | null,
  comment: string,
  context: OperationContext,
): Promise<ShelvedAway> {
  const { cm, records } = deps;
  const snapshot = await readPendingSnapshot(cm, workspacePath);
  const changes = shelvedAwayChanges(snapshot.changes, paths);
  if (changes.some((change) => change.mergeInfo)) throw new Error(IN_MERGE);

  const workspace = await readWorkspaceIdentity(cm, workspacePath);
  context.beginStep('Shelving your changes', 1, 2);
  const shelve = await createVerifiedShelve(cm, workspacePath, changes, comment, context, paths ?? undefined);
  const record = newShelveRecord(workspace, shelve.id, shelvedContents(snapshot, changes), { mode: 'leave', reason: 'shelve', objectRef: '', target: NO_TARGET });
  records.save(record);

  // From here on the changes live in the shelve: a failure puts them back.
  try {
    context.beginStep('Undoing them here', 2, 2);
    const targets = paths ? paths.map((path) => toAbsolutePath(workspacePath, path)) : ['-r', workspacePath];
    // Links too: without `--symlink` a checked-out link stays pending (and its target would be undone instead).
    await cm.execute(onLinksThemselves('undo', ...targets), { cwd: workspacePath });
    await moveNewItemsAside(cm, records, workspacePath, changes, record, deps.backupsRoot);
  } catch (error) {
    throw await undoFailed(deps, workspacePath, record, error, context);
  }
  return { shelveId: shelve.id, count: record.paths.length };
}

/** The pending changes a shelve of `paths` (null: of the whole workspace) takes. */
export function shelvedAwayChanges(changes: PendingChange[], paths: string[] | null): PendingChange[] {
  if (!paths) return changes;
  const shelved = new Set(paths);
  return changes.filter((change) => shelved.has(change.path));
}

/** Puts the shelved changes back after a failed undo, and says where they are. */
async function undoFailed(deps: ShelveAndUndoDependencies, workspacePath: string, record: SwitchShelveRecord, cause: unknown, context: OperationContext): Promise<Error> {
  const failure = `Couldn't undo the shelved changes: ${failureReason(cause)}`;
  if (await putBackAfterFailure(deps.cm, deps.leftChanges, workspacePath, record, context)) return new Error(`${failure}. Your changes were put back.`);
  return new Error(`${failure}. Shelve ${record.shelveId} holds them all.`);
}
