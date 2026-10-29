import type { PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import { readUpdateProgress } from '../cm/progress/updateProgress';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { loadXlinkArgs } from '../cm/xlinkArgs';
import { hasPendingChanges } from '../merge/hasPendingChanges';
import type { OperationContext } from '../operations/OperationTracker';
import { moveNewItemsAside } from './moveNewItemsAside';
import { shelvedContents, summarizePending } from './pendingSnapshot';
import { changesPutBackError, failureReason, putShelvedChangesBack } from './putShelvedChangesBack';
import { readPendingSnapshot } from './readPendingChanges';
import { selectorObjectRef } from './selectorObjectRef';
import type { ShelveFlowDependencies } from './shelveFlowDependencies';
import { newShelveRecord, NO_TARGET } from './shelveRecord';
import { switchApproach } from './switchApproach';
import { describeSelector } from './switchSelectors';
import { createAutomaticShelve } from './verifiedShelve';
import { readWorkspaceIdentity } from './workspaceIdentity';

const IN_MERGE = 'A merge in progress keeps its files from loading: check the merge in or undo it, then open the xlink’s folder in Files and choose Load its files on it.';

/** How a checked-in xlink's files loaded: the changes moved aside for it wait in a shelve when they couldn't merge back cleanly. */
export type XlinkLoad = { kind: 'loaded' } | { kind: 'changesWaiting'; shelveId: number };

/**
 * Loads the files of the checked-in xlink at `xlinkPath` (a workspace path) with one `cm update` of the folder holding
 * it (`loadXlinkArgs`), showing its progress as an update does. `cm` would act on pending changes itself when updating a
 * folder (its PendingChangesOnSwitchAction may say to shelve them), so it runs only once none are, as a switch does
 * (`switchApproach`): unchanged checkouts are undone, a merge in progress is left alone, and other changes are moved
 * aside, never by `cm`:
 * 1. Shelve every change with the official automatic-shelve comment, check the shelve holds them all, and record it
 *    (`reason: 'xlink'`), so "Welcome back" offers them should they not come back.
 * 2. Undo them, move the files they added aside, and load the xlink's files.
 * 3. Merge the shelve back: the workspace is at the changeset it was shelved on, so only a change made under the
 *    xlink's folder meanwhile could conflict.
 * If a step before the files load fails, the changes are put back. Private files are no change in the way.
 */
export async function loadXlink(deps: ShelveFlowDependencies, workspacePath: string, xlinkPath: string, context: OperationContext): Promise<XlinkLoad> {
  const { cm } = deps;
  const load = (step: OperationContext) =>
    cm.execute(loadXlinkArgs(workspacePath, xlinkPath), { cwd: workspacePath, onOutputLine: step.progressOf(readUpdateProgress) });
  const snapshot = await readPendingSnapshot(cm, workspacePath);
  switch (switchApproach(summarizePending(snapshot.changes))) {
    case 'switchAsIs':
      await load(context);
      return { kind: 'loaded' };
    case 'refuseMerge':
      throw new Error(IN_MERGE);
    case 'undoUnchangedCheckouts':
      await cm.query(onLinksThemselves('undo', '--unchanged', '-r', workspacePath), { cwd: workspacePath });
      await load(context);
      return { kind: 'loaded' };
    case 'shelveChanges':
      return loadAroundChanges(deps, workspacePath, snapshot, () => load(context), context);
  }
}

async function loadAroundChanges(
  deps: ShelveFlowDependencies,
  workspacePath: string,
  snapshot: PendingChangesSnapshot,
  load: () => Promise<string>,
  context: OperationContext,
): Promise<XlinkLoad> {
  const { cm, records } = deps;
  const workspace = await readWorkspaceIdentity(cm, workspacePath);
  const objectRef = await selectorObjectRef(cm, workspacePath, workspace.selector);
  if (!objectRef) throw new Error(`Couldn't find ${describeSelector(workspace.selector)} in the repository, so your changes stayed as they were.`);
  context.beginStep('Putting your changes aside', 1, 3);
  const shelve = await createAutomaticShelve(cm, workspacePath, snapshot.changes, objectRef, context);
  const record = newShelveRecord(workspace, shelve.id, shelvedContents(snapshot), { mode: 'leave', reason: 'xlink', objectRef, target: NO_TARGET });
  records.save(record);

  // From here on the changes live in the shelve: a failure puts them back.
  try {
    // Links too: without `--symlink` a checked-out link stays pending (and its target would be undone instead).
    await cm.execute(onLinksThemselves('undo', '-r', workspacePath), { cwd: workspacePath });
    await moveNewItemsAside(cm, records, workspacePath, snapshot.changes, record, deps.backupsRoot);
    if (await hasPendingChanges(cm, workspacePath)) throw new Error('Some changes are still pending after undoing them');
    context.beginStep('Loading its files', 2, 3);
    await load();
  } catch (error) {
    throw await changesPutBackError(deps, workspacePath, record, failureReason(error), context);
  }

  context.beginStep('Bringing your changes back', 3, 3);
  const broughtBack = await putShelvedChangesBack(cm, deps.leftChanges, workspacePath, record, context).catch(() => false);
  return broughtBack ? { kind: 'loaded' } : { kind: 'changesWaiting', shelveId: record.shelveId };
}
