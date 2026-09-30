import type { ItemHistory, ItemPathChange, ItemRevision } from '@shared/domain/history';
import type { ItemType } from '@shared/domain/pendingChanges';
import type { RevisionRef } from '@shared/domain/revision';
import { repositorySpec, spec } from '@shared/domain/specs';
import { toAbsolutePath } from '../files/workspacePaths';
import { parseRecords, recordFormat } from './formatRecords';
import { child, children, integer, parseXml, text, type XmlNode } from './parseXml';
import { onLinksThemselves } from './symlinkArgs';

const ITEM_TYPES: Record<string, ItemType> = { txt: 'file', bin: 'binaryFile', dir: 'directory' };

/**
 * What `cm history` reads: the workspace's file, or with `revision` the item that revision is of, which the workspace
 * may not have (moved, deleted, not loaded). By its id in its repository, as no repository path reaches through an
 * xlink (`serverpath:/lib/a.cs#cs:12` finds nothing when `lib` is one).
 */
export function itemHistoryTarget(workspacePath: string, path: string, revision?: RevisionRef): string {
  return revision ? `rev:${spec.revision(revision)}` : toAbsolutePath(workspacePath, path);
}

/** The item's revisions, moves and removals. */
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

/** The revision of the item the workspace has (`cm ls` reads the workspace, not the server): the item itself comes first. */
export function workspaceRevisionArgs(absolutePath: string): string[] {
  return onLinksThemselves('ls', absolutePath, '--format={revid}');
}

export function parseWorkspaceRevision(output: string): number | undefined {
  const revisionId = Number.parseInt(output.trim().split('\n')[0] ?? '', 10);
  return Number.isNaN(revisionId) || revisionId < 0 ? undefined : revisionId;
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
