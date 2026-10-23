import type { ItemHistory, ItemPathChange, ItemRevision } from '@shared/domain/history';
import type { ItemType } from '@shared/domain/pendingChanges';
import type { RevisionRef } from '@shared/domain/revision';
import { repositorySpec, spec } from '@shared/domain/specs';
import type { RevisionFile } from '../files/WorkspaceCopies';
import { toAbsolutePath } from '../files/workspacePaths';
import { parseRecords, recordFormat } from './formatRecords';
import { isOrganizationIdServer } from './organizationIds';
import { child, children, integer, parseXml, text, type XmlNode } from './parseXml';
import { onLinksThemselves } from './symlinkArgs';

const ITEM_TYPES: Record<string, ItemType> = { txt: 'file', bin: 'binaryFile', dir: 'directory' };

/** The item whose history is read: a workspace's file, or the item a revision is of. */
export type HistoryItem = { workspacePath: string; path: string } | { revision: RevisionRef };

/**
 * What `cm history` reads: the workspace's file, or the item a revision is of, which a workspace may not have (moved,
 * deleted, not loaded) and a repository explored without one reads too. By its id in its repository, as no repository
 * path reaches through an xlink (`serverpath:/lib/a.cs#cs:12` finds nothing when `lib` is one).
 */
export function itemHistoryTarget(item: HistoryItem): string {
  return 'revision' in item ? `rev:${spec.revision(item.revision)}` : toAbsolutePath(item.workspacePath, item.path);
}

/**
 * The item's revisions, moves and removals. XML, not records: `cm history --format` has no revision type, which
 * tells a revision's kind (text, binary, directory) and a revision from a move or a removal.
 */
export function itemHistoryArgs(target: string): string[] {
  return onLinksThemselves('history', target, '--moveddeleted', '--xml');
}

/** The records of `cm history --xml`: a move or removal is one without a revision type, whose branch field says what it did. */
export function parseHistoryRecords(xml: string): XmlNode[] {
  const histories = child(child(parseXml(xml, ['RevisionHistory', 'Revision']), 'RevisionHistoriesResult'), 'RevisionHistories');
  return children(histories, 'RevisionHistory').flatMap((history) => children(child(history, 'Revisions'), 'Revision'));
}

/**
 * `cm history` has neither revision ids nor parents: one `cm find revision` of the item it names adds both. Null for a
 * history without revisions.
 */
export function itemRevisionsArgs(records: XmlNode[]): string[] | null {
  const revision = records.find((record) => text(record.ItemId) !== '');
  if (!revision) return null;
  const repository = repositorySpec(text(revision.Repository), text(revision.Server));
  return [
    'find',
    'revision',
    `where itemid = ${integer(revision.ItemId)} on repository '${repository}'`,
    `--format=${recordFormat(['changeset', 'id', 'parent'])}`,
    '--nototal',
  ];
}

/**
 * The item the workspace has (`cm ls` reads the workspace, not the server): its revision, the repository it lives
 * in, named as people do (`rep:game@AcmeStudio@unity`), and the size and hash it was loaded with, which tell whether
 * the disk still holds it (`WorkspaceCopies`). The item itself comes first.
 */
export function workspaceItemArgs(absolutePath: string): string[] {
  return onLinksThemselves('ls', absolutePath, `--format=${recordFormat(['revid', 'repspec', 'hash', 'size'])}`);
}

export interface WorkspaceItem {
  /** Undefined for an item the workspace has no revision of. */
  revisionId?: number;
  repository: string;
  /** The loaded revision's MD5, base64, as `cm` keeps it (a checkout's is the disk's). */
  hash?: string;
  /** The loaded revision's size. */
  size?: number;
}

export function parseWorkspaceItem(output: string): WorkspaceItem | undefined {
  const [revision = '', repository = '', hash = '', size = ''] = parseRecords(output)[0] ?? [];
  const revisionId = Number.parseInt(revision, 10);
  if (repository === '') return undefined;
  return { ...(revisionId >= 0 && { revisionId }), repository: repository.replace(/^rep:/, ''), ...(hash && { hash }), ...(size !== '' && { size: Number(size) }) };
}

/** The revision the workspace loaded at `path`, as `WorkspaceCopies` remembers it; none for a checkout or no hash. */
export function loadedRevisionOf(item: WorkspaceItem | undefined, path: string): RevisionFile | undefined {
  if (item?.revisionId === undefined || item.hash === undefined) return undefined;
  return { path, revision: { revisionId: item.revisionId, repository: item.repository }, hash: item.hash, size: item.size ?? -1 };
}

/**
 * The records with a Unity organization's server by name. `cm history --xml` prints it by its id
 * (ARCHITECTURE.md "Unity organizations"); the item's `repository`, which every record is of, names it: the
 * workspace's `cm ls` of the item, or the revision the history starts from. Without it the id stays.
 */
export function withServerOf(records: XmlNode[], repository: string | undefined): XmlNode[] {
  if (repository === undefined) return records;
  const server = repository.slice(repository.indexOf('@') + 1);
  return records.map((record) => (isOrganizationIdServer(text(record.Server)) ? { ...record, Server: server } : record));
}

/** Combines the history's records with the revisions `itemRevisionsArgs` found, each list newest first. */
export function parseItemHistory(records: XmlNode[], revisionsOutput: string, workspaceRevisionId?: number): ItemHistory {
  const revisionsByChangeset = new Map(
    parseRecords(revisionsOutput).map(([changeset, id, parent]) => [Number(changeset), { id: Number(id), parent: Number(parent) }]),
  );
  const newestFirst = <T extends { changesetId: number }>(a: T, b: T): number => b.changesetId - a.changesetId;

  return {
    revisions: records
      .filter((record) => text(record.RevisionType) !== '')
      .map((record) => toRevision(record, revisionsByChangeset.get(integer(record.ChangesetNumber))))
      .sort(newestFirst),
    pathChanges: records
      .filter((record) => text(record.RevisionType) === '')
      .map(
        (record): ItemPathChange => ({
          changesetId: integer(record.ChangesetNumber),
          owner: text(record.Owner),
          date: text(record.CreationDate),
          description: text(record.Branch),
        }),
      )
      .sort(newestFirst),
    ...(workspaceRevisionId !== undefined && { workspaceRevisionId }),
  };
}

function toRevision(record: XmlNode, ids: { id: number; parent: number } | undefined): ItemRevision {
  const revisionId = ids?.id ?? -1;
  const name = text(record.Repository);
  const repository = name && repositorySpec(name, text(record.Server));
  return {
    revisionId,
    parentRevisionId: ids?.parent ?? -1,
    changesetId: integer(record.ChangesetNumber),
    branch: text(record.Branch),
    owner: text(record.Owner),
    date: text(record.CreationDate),
    comment: text(record.Comment),
    itemType: ITEM_TYPES[text(record.RevisionType)] ?? 'file',
    size: integer(record.Size, 0),
    repository,
    idSpec: revisionId >= 0 && repository ? spec.revision({ revisionId, repository }) : text(record.RevisionSpec),
  };
}
