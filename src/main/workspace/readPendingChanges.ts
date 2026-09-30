import type { PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import type { CmClient } from '../cm/CmClient';
import { parsePendingChanges } from '../cm/pendingChangesXml';

/** `cm status` arguments for everything a switch or a shelve has to take care of, private files included. */
const SNAPSHOT_STATUS_ARGS = ['status', '--xml', '--iscochanged', '--changelists', '--controlledchanged', '--changed', '--localdeleted', '--localmoved', '--private'];

/** Every pending change, private files included, with the changelists they are in. A local read. */
export async function readPendingSnapshot(cm: CmClient, workspacePath: string): Promise<PendingChangesSnapshot> {
  return parsePendingChanges(await cm.query(SNAPSHOT_STATUS_ARGS, { cwd: workspacePath }));
}

/** The workspace's private files. A local read. */
export async function readPrivatePaths(cm: CmClient, workspacePath: string): Promise<string[]> {
  const { changes } = parsePendingChanges(await cm.query(['status', '--xml', '--private'], { cwd: workspacePath }));
  return changes.filter((change) => change.kinds.includes('private')).map((change) => change.path);
}
