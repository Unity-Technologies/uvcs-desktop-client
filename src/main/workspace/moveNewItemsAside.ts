import { join } from 'node:path';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { SwitchShelveRecord } from '@shared/domain/switchWithChanges';
import type { CmClient } from '../cm/CmClient';
import { parsePendingChanges } from '../cm/pendingChangesXml';
import { newItemPaths } from './pendingSnapshot';
import { moveAside } from './privateBackups';
import type { SwitchShelveRecords } from './switchShelveRecords';

/**
 * Added files stay on disk as private files after the undo: they would show up as new files, and on a switch's target
 * (renamed `.private.0` where the target has the same path). They are moved into the app's data folder until the
 * shelve brings them back (`putBack`), and the record says where.
 */
export async function moveNewItemsAside(
  cm: CmClient,
  records: SwitchShelveRecords,
  workspacePath: string,
  changes: PendingChange[],
  record: SwitchShelveRecord,
  backupsRoot: string,
): Promise<void> {
  const privatePaths = new Set(parsePendingChanges(await cm.query(['status', '--xml', '--private'], { cwd: workspacePath })).changes.map((change) => change.path));
  const paths = newItemPaths(changes).filter((path) => privatePaths.has(path));
  if (paths.length === 0) return;

  const directory = join(backupsRoot, `${record.createdAt.replace(/[:.]/g, '-')}-sh${record.shelveId}`);
  record.backup = { directory, paths };
  records.save(record);
  await moveAside(workspacePath, paths, directory);
}
