import type { ItemRevision } from '@shared/domain/history';
import type { ItemType } from '@shared/domain/pendingChanges';
import { parseRecords, recordFormat } from './formatRecords';
import { child, children, integer, parseXml, text } from './parseXml';

/** `cm history --xml` has no revision ids, so a second `--format` call maps changesets to revisions. */
export const REVISION_IDS_FORMAT = recordFormat(['changesetid', 'id']);

const ITEM_TYPES: Record<string, ItemType> = { txt: 'file', bin: 'binaryFile', dir: 'directory' };

/** Combines `cm history --xml` with the revision ids, newest revision first. */
export function parseItemHistory(xml: string, revisionIdsOutput: string): ItemRevision[] {
  const revisionIdsByChangeset = new Map(parseRecords(revisionIdsOutput).map(([changeset, id]) => [Number(changeset), Number(id)]));
  const histories = child(child(parseXml(xml, ['RevisionHistory', 'Revision']), 'RevisionHistoriesResult'), 'RevisionHistories');

  return children(histories, 'RevisionHistory')
    .flatMap((history) => children(child(history, 'Revisions'), 'Revision'))
    .map((revision): ItemRevision => {
      const changesetId = integer(revision.ChangesetNumber);
      return {
        revisionId: revisionIdsByChangeset.get(changesetId) ?? -1,
        changesetId,
        branch: text(revision.Branch),
        owner: text(revision.Owner),
        date: text(revision.CreationDate),
        comment: text(revision.Comment),
        itemType: ITEM_TYPES[text(revision.RevisionType)] ?? 'file',
        size: integer(revision.Size, 0),
        spec: text(revision.RevisionSpec),
      };
    })
    .sort((a, b) => b.changesetId - a.changesetId);
}
