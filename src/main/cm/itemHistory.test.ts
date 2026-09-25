import { describe, expect, it } from 'vitest';
import { parseItemHistory } from './itemHistory';

const revision = (changeset: number, comment: string, type = 'txt'): string => `
  <Revision>
    <RevisionSpec>README.md#cs:${changeset}</RevisionSpec>
    <Branch>/main</Branch>
    <CreationDate>2026-09-25T09:40:43+02:00</CreationDate>
    <RevisionType>${type}</RevisionType>
    <ChangesetNumber>${changeset}</ChangesetNumber>
    <Owner>jane@example.com</Owner>
    <Comment>${comment}</Comment>
    <Size>42</Size>
  </Revision>`;

const xml = (revisions: string): string => `<?xml version="1.0" encoding="utf-8"?>
<RevisionHistoriesResult><RevisionHistories><RevisionHistory>
  <ItemName>/work/README.md</ItemName>
  <Revisions>${revisions}</Revisions>
</RevisionHistory></RevisionHistories></RevisionHistoriesResult>`;

describe('parseItemHistory', () => {
  it('lists revisions newest first with their revision ids', () => {
    const history = parseItemHistory(xml(revision(1, 'Initial import') + revision(4, 'Mention UI')), '1\u001f15\u001e\n4\u001f45\u001e\n');

    expect(history.map((item) => [item.changesetId, item.revisionId, item.comment])).toEqual([
      [4, 45, 'Mention UI'],
      [1, 15, 'Initial import'],
    ]);
    expect(history[0]).toMatchObject({ branch: '/main', owner: 'jane@example.com', itemType: 'file', size: 42, spec: 'README.md#cs:4' });
  });

  it('handles a single revision and binary files', () => {
    const [only] = parseItemHistory(xml(revision(3, '123', 'bin')), '3\u001f37\u001e');
    expect(only).toMatchObject({ changesetId: 3, revisionId: 37, comment: '123', itemType: 'binaryFile' });
  });
});
