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
    <Repository>game</Repository>
    <Server>local</Server>
    <Size>42</Size>
  </Revision>`;

/** How `--moveddeleted` lists a move: no revision type, and what happened in the branch field. */
const move = (changeset: number, description: string): string => `
  <Revision>
    <RevisionSpec>README.md#cs:${changeset}</RevisionSpec>
    <Branch>${description}</Branch>
    <CreationDate>2026-09-25T09:41:00+02:00</CreationDate>
    <RevisionType />
    <ChangesetNumber>${changeset}</ChangesetNumber>
    <Owner>bob@example.com</Owner>
    <Comment />
    <Repository>game</Repository>
    <Server>local</Server>
    <ItemId />
    <Size>0</Size>
  </Revision>`;

const xml = (revisions: string): string => `<?xml version="1.0" encoding="utf-8"?>
<RevisionHistoriesResult><RevisionHistories><RevisionHistory>
  <ItemName>/work/README.md</ItemName>
  <Revisions>${revisions}</Revisions>
</RevisionHistory></RevisionHistories></RevisionHistoriesResult>`;

describe('parseItemHistory', () => {
  it('lists revisions newest first with their revision ids', () => {
    const { revisions } = parseItemHistory(xml(revision(1, 'Initial import') + revision(4, 'Mention UI')), '1\u001f15\u001f7\u001e\n4\u001f45\u001f7\u001e\n');

    expect(revisions.map((item) => [item.changesetId, item.revisionId, item.comment])).toEqual([
      [4, 45, 'Mention UI'],
      [1, 15, 'Initial import'],
    ]);
    expect(revisions[0]).toMatchObject({ branch: '/main', owner: 'jane@example.com', itemType: 'file', size: 42, spec: 'README.md#cs:4' });
  });

  it('names each revision by its id too, which finds it before the file moved', () => {
    const [only] = parseItemHistory(xml(revision(4, 'Mention UI')), '4\u001f45\u001f7\u001e').revisions;
    expect(only).toMatchObject({ spec: 'README.md#cs:4', idSpec: 'revid:45@game@local' });
  });

  it('falls back to the path spec for a revision without an id', () => {
    const [only] = parseItemHistory(xml(revision(4, 'Mention UI')), '').revisions;
    expect(only).toMatchObject({ revisionId: -1, idSpec: 'README.md#cs:4' });
  });

  it('handles a single revision and binary files', () => {
    const [only] = parseItemHistory(xml(revision(3, '123', 'bin')), '3\u001f37\u001f7\u001e').revisions;
    expect(only).toMatchObject({ changesetId: 3, revisionId: 37, comment: '123', itemType: 'binaryFile' });
  });

  it('lists moves and removals apart, with what cm says they did', () => {
    const history = parseItemHistory(
      xml(revision(1, 'Initial import') + move(2, 'Moved from /README.txt to /README.md') + revision(5, 'Rename and edit') + move(5, 'Moved from /README.md to /docs/README.md')),
      '1\u001f15\u001f7\u001e2\u001f20\u001f\u001e5\u001f50\u001f7\u001e5\u001f52\u001f\u001e',
    );

    expect(history.revisions.map((item) => [item.changesetId, item.revisionId])).toEqual([
      [5, 50],
      [1, 15],
    ]);
    expect(history.pathChanges).toEqual([
      { changesetId: 5, owner: 'bob@example.com', date: '2026-09-25T09:41:00+02:00', description: 'Moved from /README.md to /docs/README.md' },
      { changesetId: 2, owner: 'bob@example.com', date: '2026-09-25T09:41:00+02:00', description: 'Moved from /README.txt to /README.md' },
    ]);
  });
});
