import type { DiffEntry, DiffStatus } from '@shared/domain/diff';
import type { ItemType } from '@shared/domain/pendingChanges';
import { parseRecords, recordFormat } from './formatRecords';

/** `--format` for `cm diff --repositorypaths` that `parseDiffEntries` understands. */
export const DIFF_FORMAT = recordFormat(['status', 'path', 'srccmpath', 'baserevid', 'revid', 'type']);

const STATUSES: Record<string, DiffStatus> = { A: 'added', C: 'changed', D: 'deleted', M: 'moved' };
const ITEM_TYPES: Record<string, ItemType> = { F: 'file', B: 'binaryFile', D: 'directory', X: 'xlink' };

/**
 * Parses `cm diff` records. `cm` reports a moved-and-changed item twice (M and C), so entries
 * are merged by path: the result is "moved" but keeps the content change's revisions.
 */
export function parseDiffEntries(output: string): DiffEntry[] {
  const entriesByPath = new Map<string, DiffEntry>();

  for (const record of parseRecords(output)) {
    const entry = toDiffEntry(record);
    if (!entry) continue;
    const existing = entriesByPath.get(entry.path);
    entriesByPath.set(entry.path, existing ? mergeEntries(existing, entry) : entry);
  }

  // As people read them: file_2 before file_10.
  return [...entriesByPath.values()].sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }));
}

function toDiffEntry([statusCode = '', path = '', sourcePath = '', baseRevision = '', revision = '', typeCode = '']: string[]): DiffEntry | null {
  const status = STATUSES[statusCode];
  if (!status) return null;

  const revisionId = Number(revision);
  const baseRevisionId = Number(baseRevision);
  return {
    status,
    path: withoutLeadingSlash(path),
    oldPath: status === 'moved' && sourcePath ? withoutLeadingSlash(sourcePath) : undefined,
    itemType: ITEM_TYPES[typeCode] ?? 'file',
    ...sidesOf(status, baseRevisionId, revisionId),
  };
}

/** `cm` reports a deleted item's last revision as `revid`, and a pure move without a base revision. */
function sidesOf(status: DiffStatus, baseRevisionId: number, revisionId: number): Pick<DiffEntry, 'baseRevisionId' | 'revisionId'> {
  if (status === 'deleted') return { baseRevisionId: revisionId, revisionId: -1 };
  if (status === 'moved' && baseRevisionId === -1) return { baseRevisionId: revisionId, revisionId };
  return { baseRevisionId, revisionId };
}

function mergeEntries(first: DiffEntry, second: DiffEntry): DiffEntry {
  const moved = [first, second].find((entry) => entry.status === 'moved');
  const changed = [first, second].find((entry) => entry.status === 'changed');
  if (!moved || !changed) return first;
  return { ...moved, baseRevisionId: changed.baseRevisionId, revisionId: changed.revisionId };
}

function withoutLeadingSlash(path: string): string {
  return path.replace(/^\//, '');
}
