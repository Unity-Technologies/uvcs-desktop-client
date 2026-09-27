import type { ItemHistory, ItemPathChange, ItemRevision } from '@shared/domain/history';
import type { ItemType } from '@shared/domain/pendingChanges';
import { repositorySpec, spec } from '@shared/domain/specs';
import { toAbsolutePath } from '../files/workspacePaths';
import { escapeQueryValue } from './findQuery';
import { parseRecords, recordFormat } from './formatRecords';
import { child, children, integer, parseXml, text, type XmlNode } from './parseXml';
import { onLinksThemselves } from './symlinkArgs';

const ITEM_TYPES: Record<string, ItemType> = { txt: 'file', bin: 'binaryFile', dir: 'directory' };

/**
 * What `cm history` reads: the workspace's file, or with `changesetId` the item at that repository path in that
 * changeset, which the workspace may not have (moved, deleted, not loaded).
 */
export function itemHistoryTarget(workspacePath: string, path: string, changesetId?: number): string {
  return changesetId === undefined ? toAbsolutePath(workspacePath, path) : spec.serverPathAtChangeset(`/${path}`, changesetId);
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
    `where itemid = ${integer(revision.ItemId)} on repository '${escapeQueryValue(repository)}'`,
    `--format=${recordFormat(['changeset', 'id', 'parent'])}`,
    '--nototal',
  ];
}

/** Combines the history's records with the revisions `itemRevisionsArgs` found, each list newest first. */
export function parseItemHistory(records: XmlNode[], revisionsOutput: string): ItemHistory {
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
  };
}

function toRevision(record: XmlNode, ids: { id: number; parent: number } | undefined): ItemRevision {
  const revisionId = ids?.id ?? -1;
  const pathSpec = text(record.RevisionSpec);
  const repository = text(record.Repository);
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
    spec: pathSpec,
    idSpec: revisionId >= 0 && repository ? spec.revision(revisionId, repositorySpec(repository, text(record.Server))) : pathSpec,
  };
}
