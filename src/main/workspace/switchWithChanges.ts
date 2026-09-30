import type { PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import type { PendingChangesAction, SwitchResult, SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import type { CmClient } from '../cm/CmClient';
import { onLinksThemselves } from '../cm/symlinkArgs';
import { readWorkspaceStatus } from '../cm/workspaceStatus';
import { hasPendingChanges } from '../merge/hasPendingChanges';
import type { OperationContext } from '../operations/OperationTracker';
import type { SettingsStore } from '../settings/SettingsStore';
import { applyShelveCleanly } from './applyShelveCleanly';
import { moveNewItemsAside } from './moveNewItemsAside';
import { shelvedContents, summarizePending } from './pendingSnapshot';
import { readPendingSnapshot } from './readPendingChanges';
import { privatesRenamedBySwitch } from './renamedPrivateFiles';
import { restoreOnArrival } from './restoreOnArrival';
import { rollBackSwitch } from './rollBackSwitch';
import { runSwitch } from './runSwitch';
import { selectorObjectRef } from './selectorObjectRef';
import type { ShelveFlowDependencies } from './shelveFlowDependencies';
import { newShelveRecord } from './shelveRecord';
import { bringDisabledReason, describeSelector, leaveDisabledReason, parseSelectorSpec, selectorPlace } from './switchSelectors';
import { createAutomaticShelve } from './verifiedShelve';
import { readWorkspaceIdentity, type WorkspaceIdentity } from './workspaceIdentity';

const IN_MERGE = "You're in the middle of a merge. Check it in or undo it before switching.";
const NEEDS_CHOICE = 'The workspace has pending changes. Choose whether to leave them or bring them along.';

export interface SwitchDependencies extends ShelveFlowDependencies {
  /** Whether to restore changes left on the target as the switch arrives (`restoreLeftChangesAutomatically`). */
  settings: SettingsStore;
}

/**
 * Switches the workspace, taking care of its pending changes. `cm switch` only ever runs on a clean workspace
 * (whatever client.conf's PendingChangesOnSwitchAction says), so `cm` never shelves, re-applies or merges on its own:
 * 1. Shelve every pending change with the official automatic-shelve comment and check the shelve holds them all.
 * 2. Record the shelve, undo the changes, and move the added files, now private, out of the way.
 * 3. Switch. Leaving is done; bringing merges the shelve on the target when it applies cleanly,
 *    or leaves the conflicts for the merge view.
 * If anything fails before the switch lands, the changes are put back where they were (`rollBackSwitch`).
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
  return { ...result, renamedPrivates: await privatesRenamedBySwitch(deps.cm, workspacePath, snapshot) };
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
  // Once the workspace starts changing (changes shelved, a restore under way), stopping halfway would leave a mess.
  const uncancellable: OperationContext = { ...context, signal: new AbortController().signal };

  if (summary.pendingCount === 0) {
    await runSwitch(cm, workspacePath, targetSpec, context);
    return { kind: 'switched', restored: await restoreOnArrival(deps, workspacePath, uncancellable) };
  }
  if (summary.inMerge) throw new Error(IN_MERGE);
  if (summary.unchangedCheckoutsOnly) {
    await cm.query(onLinksThemselves('undo', '--unchanged', '-r', workspacePath), { cwd: workspacePath });
    await runSwitch(cm, workspacePath, targetSpec, context);
    return { kind: 'undidUnchangedCheckouts', count: summary.pendingCount, restored: await restoreOnArrival(deps, workspacePath, uncancellable) };
  }
  if (!action) throw new Error(NEEDS_CHOICE);
  assertAllowed(action, targetSpec, workspace);

  if (context.signal.aborted) throw new Error('The switch was cancelled.');
  const record = await shelveAndSwitch(deps, workspacePath, workspace, snapshot, targetSpec, action, uncancellable);
  if (action === 'leave') {
    const restored = await restoreOnArrival(deps, workspacePath, uncancellable);
    return { kind: 'left', shelveId: record.shelveId, count: record.paths.length, sourceName: record.source.name, restored };
  }
  return bringChanges(deps, workspacePath, record, uncancellable);
}

function assertAllowed(action: PendingChangesAction, targetSpec: string, workspace: WorkspaceIdentity): void {
  if (action === 'leave' && leaveDisabledReason(workspace.selector)) throw new Error("Changes can't be left on a shelve. Bring them along, or check them in first.");
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
  const target = selectorPlace(parseSelectorSpec(targetSpec).selector);
  const record = newShelveRecord(workspace, shelve.id, shelvedContents(snapshot), { mode, objectRef, target });
  records.save(record);

  // From here on the changes live in the shelve: any failure puts them back.
  try {
    context.beginStep('Undoing them here', 2, steps);
    // Links too: without `--symlink` a checked-out link stays pending (and its target would be undone instead).
    await cm.execute(onLinksThemselves('undo', '-r', workspacePath), { cwd: workspacePath });
    await moveNewItemsAside(cm, records, workspacePath, snapshot.changes, record, deps.backupsRoot);
    await assertClean(cm, workspacePath);

    context.beginStep('Switching', 3, steps);
    await runSwitch(cm, workspacePath, targetSpec, context);
  } catch (error) {
    throw await rollBackSwitch(deps, workspacePath, record, error, context);
  }

  // Record where the switch really landed, as `cm status` names it, to recognize it later.
  const landed = (await readWorkspaceStatus(cm, workspacePath)).selector;
  const switched = { ...record, target: selectorPlace(landed) };
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
  if (await hasPendingChanges(cm, workspacePath)) throw new Error('Some changes are still pending after undoing them.');
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
