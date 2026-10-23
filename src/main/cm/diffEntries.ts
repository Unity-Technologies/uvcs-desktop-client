import type { DiffEntry, DiffStatus } from '@shared/domain/diff';
import type { ItemType } from '@shared/domain/pendingChanges';
import { comparePaths } from '@shared/pathOrder';
import type { CmClient, CmRecordsOptions } from './CmClient';
import { recordFormat, unquoted, type ReadRecord } from './formatRecords';

/**
 * `--format` for `cm diff --repositorypaths` that `readDiffEntry` understands. `{repository}` is the repository of
 * each item's revisions: under an xlink, the xlinked one. `cm diff` prints the paths and the repository between double
 * quotes, which are no part of them.
 */
export const DIFF_FORMAT = recordFormat(['status', 'path', 'srccmpath', 'baserevid', 'revid', 'type', 'repository']);

const STATUSES: Record<string, DiffStatus> = { A: 'added', C: 'changed', D: 'deleted', M: 'moved' };
const ITEM_TYPES: Record<string, ItemType> = { F: 'file', B: 'binaryFile', D: 'directory', X: 'xlink' };

/**
 * The items `cm diff` tells changed between `specs` (two changesets, a branch, a shelve), read as they arrive: a
 * changeset touching most of a big tree prints about 100 bytes a file.
 */
export async function queryDiffEntries(cm: Pick<CmClient, 'queryRecords'>, specs: string[], options: CmRecordsOptions): Promise<DiffEntry[]> {
  return mergedDiffEntries(await cm.queryRecords(['diff', ...specs, '--repositorypaths', `--format=${DIFF_FORMAT}`], readDiffEntry, options));
}

/**
 * The entries of `cm diff`, sorted by path. `cm` reports a moved-and-changed item twice (M and C), so entries are
 * merged by path: the result is "moved" but keeps the content change's revisions.
 */
export function mergedDiffEntries(entries: readonly DiffEntry[]): DiffEntry[] {
  const entriesByPath = new Map<string, DiffEntry>();
  for (const entry of entries) {
    const existing = entriesByPath.get(entry.path);
    entriesByPath.set(entry.path, existing ? mergeEntries(existing, entry) : entry);
  }
  return [...entriesByPath.values()].sort((a, b) => comparePaths(a.path, b.path));
}

/** One record of `DIFF_FORMAT`; none for a status `cm` has no word for here. */
export const readDiffEntry: ReadRecord<DiffEntry> = ([statusCode = '', quotedPath = '', quotedSourcePath = '', baseRevision = '', revision = '', typeCode = '', quotedRepository = '']) => {
  const [path, sourcePath, repository] = [unquoted(quotedPath), unquoted(quotedSourcePath), unquoted(quotedRepository)];
  const status = STATUSES[statusCode];
  if (!status) return undefined;

  const revisionId = Number(revision);
  const baseRevisionId = Number(baseRevision);
  return {
    status,
    path: withoutLeadingSlash(path),
    oldPath: status === 'moved' && sourcePath ? withoutLeadingSlash(sourcePath) : undefined,
    itemType: ITEM_TYPES[typeCode] ?? 'file',
    ...sidesOf(status, baseRevisionId, revisionId),
    repository,
  };
};

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
