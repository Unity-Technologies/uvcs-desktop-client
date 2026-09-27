import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { itemHistoryTarget, itemRevisionsArgs, parseHistoryRecords, parseItemHistory } from './itemHistory';

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
    <ItemId>7</ItemId>
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

/** `cm find revision --format={changeset}{id}{parent}` output. */
const found = (...rows: [number, number, number][]): string => rows.map((row) => `${row.join('\u001f')}\u001e\n`).join('');

const parse = (records: string, revisions: string) => parseItemHistory(parseHistoryRecords(xml(records)), revisions);

describe('parseItemHistory', () => {
  it('lists revisions newest first with their revision ids and parents', () => {
    const { revisions } = parse(revision(1, 'Initial import') + revision(4, 'Mention UI'), found([1, 15, -1], [4, 45, 15]));

    expect(revisions.map((item) => [item.changesetId, item.revisionId, item.parentRevisionId, item.comment])).toEqual([
      [4, 45, 15, 'Mention UI'],
      [1, 15, -1, 'Initial import'],
    ]);
    expect(revisions[0]).toMatchObject({ branch: '/main', owner: 'jane@example.com', itemType: 'file', size: 42, spec: 'README.md#cs:4' });
  });

  it('names each revision by its id too, which finds it before the file moved', () => {
    const [only] = parse(revision(4, 'Mention UI'), found([4, 45, 15])).revisions;
    expect(only).toMatchObject({ spec: 'README.md#cs:4', idSpec: 'revid:45@game@local' });
  });

  it('falls back to the path spec for a revision without an id', () => {
    const [only] = parse(revision(4, 'Mention UI'), '').revisions;
    expect(only).toMatchObject({ revisionId: -1, parentRevisionId: -1, idSpec: 'README.md#cs:4' });
  });

  it('handles a single revision and binary files', () => {
    const [only] = parse(revision(3, '123', 'bin'), found([3, 37, -1])).revisions;
    expect(only).toMatchObject({ changesetId: 3, revisionId: 37, comment: '123', itemType: 'binaryFile' });
  });

  it('lists moves and removals apart, with what cm says they did', () => {
    const history = parse(
      revision(1, 'Initial import') + move(2, 'Moved from /README.txt to /README.md') + revision(5, 'Rename and edit') + move(5, 'Moved from /README.md to /docs/README.md'),
      found([1, 15, -1], [5, 50, 15]),
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

describe('itemRevisionsArgs', () => {
  it('finds the revisions of the item the history names, in its repository', () => {
    const records = parseHistoryRecords(xml(move(2, 'Moved from /a to /b') + revision(1, 'Initial import')));
    expect(itemRevisionsArgs(records)?.slice(0, 3)).toEqual(['find', 'revision', "where itemid = 7 on repository 'game@local'"]);
  });

  it('asks nothing for a history without revisions', () => {
    expect(itemRevisionsArgs(parseHistoryRecords(xml(move(2, 'Removed /a'))))).toBeNull();
  });
});

describe('itemHistoryTarget', () => {
  it("reads the workspace's file, or the repository path in a changeset", () => {
    expect(itemHistoryTarget('/work', 'src/a.cs')).toBe(join('/work', 'src', 'a.cs'));
    expect(itemHistoryTarget('/work', 'src/a.cs', 42)).toBe('serverpath:/src/a.cs#cs:42');
  });
});
