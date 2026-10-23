import type { CmClient } from '../cm/CmClient';
import { statusRecordsArgs } from '../cm/pendingChangesRecords';

/** The records of `cm status --machinereadable` that are no change: its header, a file's conflict markers. */
const NO_CHANGE_RECORDS = new Set(['STATUS', 'CONFLICT_MARKERS']);

/**
 * Whether the workspace has pending changes (private files aside): `cm merge` refuses to merge into such a workspace,
 * and a switch only ever runs without them. A local read, its records read as they arrive (a workspace may hold a
 * million changes).
 */
export async function hasPendingChanges(cm: CmClient, workspacePath: string): Promise<boolean> {
  const args = statusRecordsArgs('--controlledchanged', '--changed', '--localdeleted');
  const changes = await cm.queryRecords(args, ([tag = '']) => (NO_CHANGE_RECORDS.has(tag) ? undefined : true), { cwd: workspacePath });
  return changes.length > 0;
}
