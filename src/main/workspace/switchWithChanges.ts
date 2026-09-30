import type { PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import type { PendingChangesAction, RenamedPrivateFile, RestoredChanges, SwitchResult, SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import type { CmClient } from '../cm/CmClient';
import { readUpdateProgress } from '../cm/progress/updateProgress';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { switchArgs } from '../cm/updateArgs';
import { readWorkspaceStatus } from '../cm/workspaceStatus';
import type { OperationContext } from '../operations/OperationTracker';
import type { SettingsStore } from '../settings/SettingsStore';
import type { LeftChangesFinder } from './leftChanges';
import { changedPaths, shelvedChangelists, summarizePending } from './pendingSnapshot';
import { putShelvedChangesBack } from './putShelvedChangesBack';
import { readPendingSnapshot, readPrivatePaths } from './readPendingChanges';
import { renamedPrivateFiles } from './renamedPrivateFiles';
import { selectorObjectRef } from './selectorObjectRef';
import { selectorSpec } from '@shared/domain/specs';
import { bringDisabledReason, describeSelector, parseSelectorSpec } from './switchSelectors';
import type { SwitchShelveRecords } from './switchShelveRecords';
import { applyShelveCleanly } from './applyShelveCleanly';
import { moveNewItemsAside } from './moveNewItemsAside';
import { createAutomaticShelve } from './verifiedShelve';
import { readWorkspaceIdentity, type WorkspaceIdentity } from './workspaceIdentity';

const IN_MERGE = "You're in the middle of a merge. Check it in or undo it before switching.";
const NEEDS_CHOICE = 'The workspace has pending changes. Choose whether to leave them or bring them along.';

export interface SwitchDependencies {
  cm: CmClient;
  settings: SettingsStore;
  records: SwitchShelveRecords;
  leftChanges: LeftChangesFinder;
  /** Where added files are moved aside while their changes are in a switch shelve. */
  backupsRoot: string;
}

/**
 * Switches the workspace, taking care of its pending changes. `cm switch` only ever runs on a clean workspace
 * (whatever client.conf's PendingChangesOnSwitchAction says), so `cm` never shelves, re-applies or merges on its own:
 * 1. Shelve every pending change with the official automatic-shelve comment and check the shelve holds them all.
 * 2. Record the shelve, undo the changes, and move the added files, now private, out of the way.
 * 3. Switch. Leaving is done; bringing merges the shelve on the target when it applies cleanly,
 *    or leaves the conflicts for the merge view.
 * If anything fails before the switch lands, the changes are put back where they were.
 */
export async function switchWithChanges(
  deps: SwitchDependencies,
  workspacePath: string,
  targetSpec: string,
  action: PendingChangesAction | undefined,
  context: OperationContext,
): Promise<SwitchResult> {
  const workspace = await readWorkspaceIdentity(deps.cm, workspacePath);
  const snapshot = await readPendingSnapshot(deps.cm, workspacePath);
  const result = await switchFrom(deps, workspacePath, workspace, snapshot, targetSpec, action, context);
  return { ...result, renamedPrivates: await privatesRenamedSince(deps.cm, workspacePath, snapshot) };
}

async function switchFrom(
  deps: SwitchDependencies,
  workspacePath: string,
  workspace: WorkspaceIdentity,
  snapshot: PendingChangesSnapshot,
  targetSpec: string,
  action: PendingChangesAction | undefined,
  context: OperationContext,
): Promise<SwitchResult> {
  const { cm } = deps;
  const summary = summarizePending(snapshot.changes);
  const switchTo = (): Promise<string> =>
    cm.execute(switchArgs(targetSpec), { cwd: workspacePath, signal: context.signal, onOutputLine: context.progressOf(readUpdateProgress) });
  // Once the workspace starts changing (changes shelved, a restore under way), stopping halfway would leave a mess.
  const committed: OperationContext = { ...context, signal: new AbortController().signal };

  if (summary.pendingCount === 0) {
    await switchTo();
    return { kind: 'switched', restored: await restoreOnArrival(deps, workspacePath, committed) };
  }
  if (summary.inMerge) throw new Error(IN_MERGE);
  if (summary.unchangedCheckoutsOnly) {
    await cm.query(onLinksThemselves('undo', '--unchanged', '-r', workspacePath), { cwd: workspacePath });
    await switchTo();
    return { kind: 'undidUnchangedCheckouts', count: summary.pendingCount, restored: await restoreOnArrival(deps, workspacePath, committed) };
  }
  if (!action) throw new Error(NEEDS_CHOICE);
  assertAllowed(action, targetSpec, workspace);

  if (context.signal.aborted) throw new Error('The switch was cancelled.');
  const record = await shelveAndSwitch(deps, workspacePath, workspace, snapshot, targetSpec, action, committed);
  if (action === 'leave') {
    const restored = await restoreOnArrival(deps, workspacePath, committed);
    return { kind: 'left', shelveId: record.shelveId, count: record.paths.length, sourceName: record.source.name, restored };
  }
  return bringChanges(deps, workspacePath, record, committed);
}

/** Private files can only be in the way when there were some: otherwise nothing more is read. */
async function privatesRenamedSince(cm: CmClient, workspacePath: string, snapshot: PendingChangesSnapshot): Promise<RenamedPrivateFile[] | undefined> {
  const before = snapshot.changes.filter((change) => change.kinds.includes('private')).map((change) => change.path);
  if (before.length === 0) return undefined;
  try {
    const after = await readPrivatePaths(cm, workspacePath);
    const renamed = renamedPrivateFiles(before, after);
    return renamed.length > 0 ? renamed : undefined;
  } catch {
    // The switch is done; this only adds to what it tells.
    return undefined;
  }
}

function assertAllowed(action: PendingChangesAction, targetSpec: string, workspace: WorkspaceIdentity): void {
  if (action === 'leave' && workspace.selector.kind === 'shelve') throw new Error("Changes can't be left on a shelve. Bring them along, or check them in first.");
  if (action === 'bring' && bringDisabledReason(targetSpec, workspace.repositoryName)) throw new Error("Your changes can't be brought to this target.");
}

async function shelveAndSwitch(
  deps: SwitchDependencies,
  workspacePath: string,
  workspace: WorkspaceIdentity,
  snapshot: PendingChangesSnapshot,
  targetSpec: string,
  mode: PendingChangesAction,
  context: OperationContext,
): Promise<SwitchShelveRecord> {
  const { cm, records } = deps;
  const steps = mode === 'bring' ? 4 : 3;
  context.beginStep('Shelving your changes', 1, steps);
  const objectRef = await sourceObjectRef(cm, workspacePath, workspace);
  const shelve = await createAutomaticShelve(cm, workspacePath, snapshot.changes, objectRef, context);
  const target = parseSelectorSpec(targetSpec).selector;
  const record: SwitchShelveRecord = {
    workspaceGuid: workspace.guid,
    shelveId: shelve.id,
    repository: workspace.repository,
    source: { spec: selectorSpec(workspace.selector), name: describeSelector(workspace.selector), objectRef },
    target: { spec: selectorSpec(target), name: describeSelector(target) },
    mode,
    createdAt: new Date().toISOString(),
    paths: changedPaths(snapshot.changes),
    changelists: shelvedChangelists(snapshot),
  };
  records.save(record);

  // From here on the changes live in the shelve: any failure puts them back.
  try {
    context.beginStep('Undoing them here', 2, steps);
    // Links too: without `--symlink` a checked-out link stays pending (and its target would be undone instead).
    await cm.execute(onLinksThemselves('undo', '-r', workspacePath), { cwd: workspacePath });
    await moveNewItemsAside(cm, records, workspacePath, snapshot.changes, record, deps.backupsRoot);
    await assertClean(cm, workspacePath);

    context.beginStep('Switching', 3, steps);
    await cm.execute(switchArgs(targetSpec), { cwd: workspacePath, onOutputLine: context.progressOf(readUpdateProgress) });
  } catch (error) {
    throw await rollBack(deps, workspacePath, record, error, context);
  }

  // Record where the switch really landed, as `cm status` names it, to recognize it later.
  const landed = (await readWorkspaceStatus(cm, workspacePath)).selector;
  const switched = { ...record, target: { spec: selectorSpec(landed), name: describeSelector(landed) } };
  records.save(switched);
  return switched;
}

/** The official comment names where the changes were made. Shelve selectors have no such reference. */
async function sourceObjectRef(cm: CmClient, workspacePath: string, workspace: WorkspaceIdentity): Promise<string> {
  if (workspace.selector.kind === 'shelve') return `sh:${workspace.selector.name}`;
  const objectRef = await selectorObjectRef(cm, workspacePath, workspace.selector);
  if (!objectRef) throw new Error(`Couldn't find ${describeSelector(workspace.selector)} in the repository, so nothing was switched.`);
  return objectRef;
}

async function assertClean(cm: CmClient, workspacePath: string): Promise<void> {
  const output = await cm.query(['status', '--short', '--controlledchanged', '--changed', '--localdeleted'], { cwd: workspacePath });
  if (output.trim()) throw new Error('Some changes are still pending after undoing them.');
}

/**
 * Puts the changes back where they were made: the workspace back on the source when the switch moved it halfway, the
 * files moved aside, then the shelve merged back. If that isn't possible the record stays, so the changes are offered
 * for restore on the source.
 */
async function rollBack(deps: SwitchDependencies, workspacePath: string, record: SwitchShelveRecord, cause: unknown, context: OperationContext): Promise<Error> {
  const reason = (cause instanceof Error ? cause.message : String(cause)).replace(/\.$/, '');
  let onSource = false;
  try {
    onSource = await returnToSource(deps.cm, workspacePath, record.source.spec, context);
    if (onSource && (await putShelvedChangesBack(deps.cm, deps.leftChanges, workspacePath, record, context))) {
      return new Error(`${reason}. Your changes were put back.`);
    }
  } catch {
    // Reported below: the changes are still safe in the shelve.
  }
  deps.records.save({ ...record, mode: 'leave' });
  const restoreFrom = onSource ? 'restore them from Changes' : `switch back to ${record.source.name} to restore them`;
  return new Error(`${reason}. Your changes are safe in shelve ${record.shelveId}; ${restoreFrom}.`);
}

/**
 * A switch that fails halfway has already moved the workspace to the target, some files updated and others not: it
 * goes back (nothing is pending by then). Resolves to whether the workspace is on the source.
 */
async function returnToSource(cm: CmClient, workspacePath: string, sourceSpec: string, context: OperationContext): Promise<boolean> {
  const isOnSource = async (): Promise<boolean> => selectorSpec((await readWorkspaceStatus(cm, workspacePath)).selector) === sourceSpec;
  if (await isOnSource()) return true;
  await cm.execute(switchArgs(sourceSpec), { cwd: workspacePath, onOutputLine: context.progressOf(readUpdateProgress) });
  return isOnSource();
}

async function bringChanges(deps: SwitchDependencies, workspacePath: string, record: SwitchShelveRecord, context: OperationContext): Promise<SwitchResult> {
  context.beginStep('Bringing your changes', 4, 4);
  try {
    const outcome = await applyShelveCleanly(deps.cm, workspacePath, record.shelveId, context);
    if (outcome.kind === 'applied') {
      await deps.leftChanges.finish(workspacePath, record);
      return { kind: 'brought' };
    }
    return { kind: 'bringPending', shelveId: record.shelveId, conflictCount: outcome.kind === 'conflicts' ? outcome.count : 0 };
  } catch {
    // The switch is done and the changes are safe in the shelve; the merge view explains what went wrong.
    return { kind: 'bringPending', shelveId: record.shelveId, conflictCount: 0 };
  }
}

/**
 * Coming back to where changes were left: restores them right away when the setting allows it,
 * this app left exactly one set of changes here, and they apply without conflicts. Otherwise the banner offers them.
 */
async function restoreOnArrival(deps: SwitchDependencies, workspacePath: string, context: OperationContext): Promise<RestoredChanges | undefined> {
  if (!deps.settings.get().restoreLeftChangesAutomatically) return undefined;
  try {
    // Only this app's own left changes are restored: without any waiting here, the server has nothing to tell.
    if (!(await deps.leftChanges.hasOwnWaiting(workspacePath))) return undefined;
    const left = await deps.leftChanges.find(workspacePath);
    const [only] = left;
    if (left.length !== 1 || !only || only.foreign || only.mode !== 'leave') return undefined;

    context.reportProgress('Restoring the changes you left here…');
    const result = await deps.leftChanges.restore(workspacePath, only.shelveId, context);
    return result.kind === 'restored' ? { count: result.count } : undefined;
  } catch {
    return undefined;
  }
}
