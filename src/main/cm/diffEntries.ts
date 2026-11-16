import type { DiffEntry, DiffStatus, PermissionsChange } from '@shared/domain/diff';
import type { ItemType } from '@shared/domain/pendingChanges';
import { comparePaths } from '@shared/pathOrder';
import type { CmClient, CmRecordsOptions } from './CmClient';
import { recordFormat, unquoted, type ReadRecord } from './formatRecords';

/**
 * `--format` for `cm diff --repositorypaths` that `readDiffEntry` understands. `{repository}` is the repository of
 * each item's revisions: under an xlink, the xlinked one. `{srcfsprotection}` and `{fsprotection}` are the item's file
 * permissions before and after (`-rw-r--r--`, nothing where none is set). `cm diff` prints the paths, the repository and
 * the permissions between double quotes, which are no part of them.
 */
export const DIFF_FORMAT = recordFormat(['status', 'path', 'srccmpath', 'baserevid', 'revid', 'type', 'repository', 'srcfsprotection', 'fsprotection']);

const STATUSES: Record<string, DiffStatus> = { A: 'added', C: 'changed', D: 'deleted', M: 'moved' };
const ITEM_TYPES: Record<string, ItemType> = { F: 'file', B: 'binaryFile', D: 'directory', X: 'xlink' };

/**
 * The items `cm diff` tells changed between `specs` (two changesets, a branch, a shelve), read as they arrive: a
 * changeset touching most of a big tree prints about 130 bytes a file.
 */
export async function queryDiffEntries(cm: Pick<CmClient, 'queryRecords'>, specs: string[], options: CmRecordsOptions): Promise<DiffEntry[]> {
  return mergedDiffEntries(await cm.queryRecords(['diff', ...specs, '--repositorypaths', `--format=${DIFF_FORMAT}`], readDiffEntry, options));
}

/**
 * The entries of `cm diff`, sorted by path. `cm` reports some paths twice, so entries are merged by path (one entry a
 * path, as every list of files keys them): a moved-and-changed item (M and C) is "moved" but keeps the content change's
 * revisions; an item deleted and another put at its path (D and A) is one replaced entry (`replacedEntry`).
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
export const readDiffEntry: ReadRecord<DiffEntry> = ([
  statusCode = '',
  quotedPath = '',
  quotedSourcePath = '',
  baseRevision = '',
  revision = '',
  typeCode = '',
  quotedRepository = '',
  quotedPermissionsBefore = '',
  quotedPermissionsAfter = '',
]) => {
  const [path, sourcePath, repository] = [unquoted(quotedPath), unquoted(quotedSourcePath), unquoted(quotedRepository)];
  const status = STATUSES[statusCode];
  if (!status) return undefined;

  const itemType = ITEM_TYPES[typeCode] ?? 'file';
  const revisionId = Number(revision);
  const baseRevisionId = Number(baseRevision);
  const entry: DiffEntry = {
    status,
    path: withoutLeadingSlash(path),
    oldPath: status === 'moved' && sourcePath ? withoutLeadingSlash(sourcePath) : undefined,
    itemType,
    ...sidesOf(status, baseRevisionId, revisionId),
    repository,
  };
  if (!onlyPermissionsChanged(status, itemType, baseRevisionId, revisionId)) return entry;
  return { ...entry, permissionsChange: permissionsChange(unquoted(quotedPermissionsBefore), unquoted(quotedPermissionsAfter)) };
};

/**
 * `cm` reports a deleted item's last revision as `revid`, and an item without a base revision, a pure move or a change
 * of its permissions alone (`onlyPermissionsChanged`), as its one revision on both sides.
 */
function sidesOf(status: DiffStatus, baseRevisionId: number, revisionId: number): Pick<DiffEntry, 'baseRevisionId' | 'revisionId'> {
  if (status === 'deleted') return { baseRevisionId: revisionId, revisionId: -1 };
  if ((status === 'moved' || status === 'changed') && baseRevisionId === -1) return { baseRevisionId: revisionId, revisionId };
  return { baseRevisionId, revisionId };
}

/**
 * Whether a changed item kept its content and changed only its file permissions: `cm` gives a change without a content
 * change no base revision. A changed xlink has no revisions at all: where it points changed, not its permissions.
 */
function onlyPermissionsChanged(status: DiffStatus, itemType: DiffEntry['itemType'], baseRevisionId: number, revisionId: number): boolean {
  return status === 'changed' && itemType !== 'xlink' && baseRevisionId === -1 && revisionId !== -1;
}

function permissionsChange(before: string, after: string): PermissionsChange {
  return { before: before || null, after: after || null };
}

function mergeEntries(first: DiffEntry, second: DiffEntry): DiffEntry {
  const withStatus = (status: DiffStatus) => [first, second].find((entry) => entry.status === status);
  const [moved, changed] = [withStatus('moved'), withStatus('changed')];
  if (moved && changed) return { ...moved, baseRevisionId: changed.baseRevisionId, revisionId: changed.revisionId };
  const [deleted, added] = [withStatus('deleted'), withStatus('added')];
  if (deleted && added) return sameKind(deleted, added) ? replacedEntry(deleted, added) : added;
  return first;
}

/**
 * Whether two items at one path have contents to compare: two files (text or binary), or two folders. A folder replaced
 * by a file, or anything by an xlink, has none, so the path reads as the added item alone, as before.
 */
function sameKind(deleted: DiffEntry, added: DiffEntry): boolean {
  const kindOf = (entry: DiffEntry) => (entry.itemType === 'binaryFile' ? 'file' : entry.itemType);
  return kindOf(deleted) === kindOf(added) && added.itemType !== 'xlink';
}

/** The path changed from the deleted item's last revision to the added one's: two items, so it's marked `replaced`. */
function replacedEntry(deleted: DiffEntry, added: DiffEntry): DiffEntry {
  return { ...added, status: 'changed', baseRevisionId: deleted.baseRevisionId, replaced: true };
}

function withoutLeadingSlash(path: string): string {
  return path.replace(/^\//, '');
}
