import type { Lock, LockStatus } from '@shared/domain/lock';
import { repositorySpec } from '@shared/domain/specs';
import { FIELD_SEPARATOR, RECORD_SEPARATOR, type ReadRecord } from './formatRecords';

/** Arguments that make `cm lock list` print one record per lock, as `--format` records are (`readLock`). */
export const LOCK_LIST_FORMAT_ARGS = [
  '--machinereadable',
  '--smartlocks',
  `--fieldseparator=${FIELD_SEPARATOR}`,
  `--endlineseparator=${RECORD_SEPARATOR}`,
  '--dateformat=yyyy-MM-ddTHH:mm:sszzz',
];

/**
 * Reads a lock of `cm lock list` in the smart-locks machine-readable layout, as it arrives (`queryRecords`): repository,
 * item id, guid, date, destination branch, destination revision, holder branch, holder revision, status, owner,
 * workspace, path. None for a record with fewer fields.
 */
export function lockReader(repositoryServer: string): ReadRecord<Lock> {
  return (fields) => {
    if (fields.length < 12) return undefined;
    const [repository = '', itemId, guid = '', date = '', destinationBranch = '', , holderBranch = '', , status, owner = '', workspace = '', path = ''] = fields;
    return {
      repository: repositorySpec(repository.trimStart(), repositoryServer),
      itemId: Number(itemId),
      guid,
      date,
      destinationBranch,
      holderBranch,
      status: status as LockStatus,
      owner,
      workspace,
      path: path.trimEnd(),
    };
  };
}
