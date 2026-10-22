import type { PendingChangesSnapshot } from '@shared/domain/pendingChanges';
import type { CmClient } from '../cm/CmClient';
import { PendingChangesReader, statusRecordsArgs } from '../cm/pendingChangesRecords';
import { DiskDetails } from '../files/DiskDetails';

/** `cm status` options for everything a switch or a shelve has to take care of, private files included. */
const SNAPSHOT_STATUS_OPTIONS = ['--iscochanged', '--changelists', '--controlledchanged', '--changed', '--localdeleted', '--localmoved', '--private'];

interface ReadOptions {
  /** Each file's size, date and whether it is a link, read from the disk (`DiskDetails`): what Changes shows and sums. */
  diskDetails?: boolean;
  platform?: NodeJS.Platform;
}

/**
 * The pending changes `cm status <options>` finds, read as records as they arrive (`PendingChangesReader`): a local
 * read, which never holds the whole output, so a workspace of a million changes reads as one of a thousand does.
 */
export async function readPendingChanges(
  cm: CmClient,
  workspacePath: string,
  statusOptions: string[],
  { diskDetails = false, platform = process.platform }: ReadOptions = {},
): Promise<PendingChangesSnapshot> {
  const details = diskDetails ? new DiskDetails() : undefined;
  const reader = new PendingChangesReader(workspacePath, platform, details && ((change, absolutePath) => details.add(change, absolutePath)));
  const changes = await cm.queryRecords(statusRecordsArgs(...statusOptions), reader.read, { cwd: workspacePath });
  await details?.finished();
  return reader.snapshot(changes);
}

/** Every pending change, private files included, with the changelists they are in. A local read. */
export function readPendingSnapshot(cm: CmClient, workspacePath: string): Promise<PendingChangesSnapshot> {
  return readPendingChanges(cm, workspacePath, SNAPSHOT_STATUS_OPTIONS);
}

/** The workspace's private files. A local read. */
export async function readPrivatePaths(cm: CmClient, workspacePath: string): Promise<string[]> {
  const { changes } = await readPendingChanges(cm, workspacePath, ['--private']);
  return changes.filter((change) => change.kinds.includes('private')).map((change) => change.path);
}
