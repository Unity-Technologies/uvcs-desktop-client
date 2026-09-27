import type { ItemHistory, ItemPathChange, ItemRevision } from '@shared/domain/history';
import type { ItemType } from '@shared/domain/pendingChanges';
import { repositorySpec, spec } from '@shared/domain/specs';
import { parseRecords, recordFormat } from './formatRecords';
import { child, children, integer, parseXml, text, type XmlNode } from './parseXml';

/**
 * `cm history --xml` has no revision ids, so a second `--format` call maps changesets to revisions. Moves and removals
 * have no item id there: their ids aren't the item's revisions.
 */
export const REVISION_IDS_FORMAT = recordFormat(['changesetid', 'id', 'itemid']);

const ITEM_TYPES: Record<string, ItemType> = { txt: 'file', bin: 'binaryFile', dir: 'directory' };

/**
 * Combines `cm history --moveddeleted --xml` with the revision ids, newest first. A move or removal is a record without
 * a revision type, whose branch field holds what `cm` says it did.
 */
export function parseItemHistory(xml: string, revisionIdsOutput: string): ItemHistory {
  const revisionIdsByChangeset = new Map(
    parseRecords(revisionIdsOutput)
      .filter(([, , itemId]) => itemId !== '')
      .map(([changeset, id]) => [Number(changeset), Number(id)]),
  );
  const histories = child(child(parseXml(xml, ['RevisionHistory', 'Revision']), 'RevisionHistoriesResult'), 'RevisionHistories');
  const records = children(histories, 'RevisionHistory').flatMap((history) => children(child(history, 'Revisions'), 'Revision'));
  const newestFirst = <T extends { changesetId: number }>(a: T, b: T): number => b.changesetId - a.changesetId;

  return {
    revisions: records
      .filter((record) => text(record.RevisionType) !== '')
      .map((record) => toRevision(record, revisionIdsByChangeset))
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

function toRevision(record: XmlNode, revisionIdsByChangeset: ReadonlyMap<number, number>): ItemRevision {
  const changesetId = integer(record.ChangesetNumber);
  const revisionId = revisionIdsByChangeset.get(changesetId) ?? -1;
  const pathSpec = text(record.RevisionSpec);
  const repository = text(record.Repository);
  return {
    revisionId,
    changesetId,
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
