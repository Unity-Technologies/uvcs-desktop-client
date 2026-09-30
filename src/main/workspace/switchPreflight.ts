import type { PendingChange } from '@shared/domain/pendingChanges';
import { selectorSpec } from '@shared/domain/specs';
import type { SwitchPreflight } from '@shared/domain/switchWithChanges';
import type { CmClient } from '../cm/CmClient';
import { LOCK_LIST_FORMAT_ARGS, parseLocks } from '../cm/lockRecords';
import { isLeftChanges } from './leftChangesRecords';
import { shelvableChanges, summarizePending } from './pendingSnapshot';
import { readPendingSnapshot } from './readPendingChanges';
import { switchApproach } from './switchApproach';
import { bringDisabledReason, describeSelector, leaveDisabledReason } from './switchSelectors';
import type { SwitchShelveRecords } from './switchShelveRecords';
import { readWorkspaceIdentity, type WorkspaceIdentity } from './workspaceIdentity';

/** Reads what the pending changes allow before switching, so the app can offer the right choices. */
export async function readSwitchPreflight(cm: CmClient, records: SwitchShelveRecords, workspacePath: string, targetSpec: string): Promise<SwitchPreflight> {
  const [workspace, { changes }] = await Promise.all([readWorkspaceIdentity(cm, workspacePath), readPendingSnapshot(cm, workspacePath)]);
  const summary = summarizePending(changes);
  const needsChoice = switchApproach(summary) === 'shelveChanges';

  return {
    sourceName: describeSelector(workspace.selector),
    ...summary,
    lockedPaths: needsChoice ? await lockedPendingPaths(cm, workspacePath, workspace, shelvableChanges(changes)) : [],
    bringDisabledReason: bringDisabledReason(targetSpec, workspace.repositoryName),
    leaveDisabledReason: leaveDisabledReason(workspace.selector),
    leftShelveCount: countLeftOnSource(records, workspace),
  };
}

/**
 * The shelves already left where the workspace is: not those brought along, nor the ones the user shelved away, which
 * aren't changes left behind ("Welcome back" never offers them either).
 */
function countLeftOnSource(records: SwitchShelveRecords, workspace: WorkspaceIdentity): number {
  const sourceSpec = selectorSpec(workspace.selector);
  return records
    .forWorkspace(workspace.guid)
    .filter((record) => record.mode === 'leave' && isLeftChanges(record) && record.repository === workspace.repository && record.source.spec === sourceSpec).length;
}

/** Pending paths locked by this user in this workspace: undoing them for the switch releases their locks. */
async function lockedPendingPaths(cm: CmClient, workspacePath: string, workspace: WorkspaceIdentity, pending: PendingChange[]): Promise<string[]> {
  const output = await cm.query(['lock', 'list', '--onlycurrentuser', '--onlycurrentworkspace', ...LOCK_LIST_FORMAT_ARGS], { cwd: workspacePath });
  const server = workspace.repository.slice(workspace.repository.indexOf('@') + 1);
  const lockedPaths = new Set(
    parseLocks(output, server)
      .filter((lock) => lock.repository === workspace.repository)
      .map((lock) => lock.path.replace(/^\//, '')),
  );
  return pending.map((change) => change.path).filter((path) => lockedPaths.has(path));
}
