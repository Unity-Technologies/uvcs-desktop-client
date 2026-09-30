import type { Lock, LockStatus } from '@shared/domain/lock';
import { repositorySpec } from '@shared/domain/specs';
import { FIELD_SEPARATOR, RECORD_SEPARATOR } from './formatRecords';

/** Arguments that make `cm lock list` print one parseable record per lock. */
export const LOCK_LIST_FORMAT_ARGS = [
  '--machinereadable',
  '--smartlocks',
  `--fieldseparator=${FIELD_SEPARATOR}`,
  `--endlineseparator=${RECORD_SEPARATOR}`,
  '--dateformat=yyyy-MM-ddTHH:mm:sszzz',
];

/**
 * Parses `cm lock list` in the smart-locks machine-readable layout:
 * repository, item id, guid, date, destination branch, destination revision,
 * holder branch, holder revision, status, owner, workspace, path.
 */
export function parseLocks(output: string, repositoryServer: string): Lock[] {
  return output
    .split(RECORD_SEPARATOR)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(FIELD_SEPARATOR))
    .filter((fields) => fields.length >= 12)
    .map(([repository, itemId, guid, date, destinationBranch, , holderBranch, , status, owner, workspace, path]) => ({
      repository: repositorySpec(repository!, repositoryServer),
      itemId: Number(itemId),
      guid: guid!,
      date: date!,
      destinationBranch: destinationBranch!,
      holderBranch: holderBranch!,
      status: status as LockStatus,
      owner: owner!,
      workspace: workspace!,
      path: path!,
    }));
}
