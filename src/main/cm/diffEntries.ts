import type { DiffEntry, DiffStatus } from '@shared/domain/diff';
import type { ItemType } from '@shared/domain/pendingChanges';
import { parseRecords, recordFormat } from './formatRecords';

const STATUSES: Record<string, DiffStatus> = { A: 'added', C: 'changed', D: 'deleted', M: 'moved' };
const ITEM_TYPES: Record<string, ItemType> = { F: 'file', B: 'binaryFile', D: 'directory' };

/** `--format` for `cm diff <spec> [<spec>]` that `parseDiffEntries` understands. */
export const DIFF_ENTRY_FORMAT = recordFormat(['status', 'path', 'srccmpath', 'baserevid', 'revid', 'type']);

/**
 * `cm diff` reports deleted and moved items with the revision on the right only, even though
 * that revision is the one on the left. Normalize so each side always names its own revision.
 */
export function parseDiffEntries(output: string): DiffEntry[] {
  return parseRecords(output).map(([status, path, oldPath, baseRevisionId, revisionId, type]) => {
    const diffStatus = STATUSES[status!] ?? 'changed';
    const base = Number(baseRevisionId);
    const revision = Number(revisionId);

    return {
      status: diffStatus,
      path: path!,
      oldPath: diffStatus === 'moved' ? oldPath : undefined,
      itemType: ITEM_TYPES[type!] ?? 'file',
      baseRevisionId: diffStatus === 'deleted' || (diffStatus === 'moved' && base === -1) ? revision : base,
      revisionId: diffStatus === 'deleted' ? -1 : revision,
    };
  });
}
