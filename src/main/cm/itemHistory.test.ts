import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { itemHistoryTarget, itemRevisionsArgs, parseHistoryRecords, parseItemHistory, parseWorkspaceItem, withServerOf } from './itemHistory';
import { formatOutput, UNITY_ORGANIZATION } from './testing/cmOutput';

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

const parse = (records: string, revisions: string) => parseItemHistory(parseHistoryRecords(xml(records)), revisions);

describe('parseItemHistory', () => {
  it('lists revisions newest first with their revision ids and parents', () => {
    const { revisions } = parse(revision(1, 'Initial import') + revision(4, 'Mention UI'), formatOutput([1, 15, -1], [4, 45, 15]));

    expect(revisions.map((item) => [item.changesetId, item.revisionId, item.parentRevisionId, item.comment])).toEqual([
      [4, 45, 15, 'Mention UI'],
      [1, 15, -1, 'Initial import'],
    ]);
    expect(revisions[0]).toMatchObject({ branch: '/main', owner: 'jane@example.com', itemType: 'file', size: 42, repository: 'game@local' });
  });

  it('names each revision by its id too, which finds it before the file moved', () => {
    const [only] = parse(revision(4, 'Mention UI'), formatOutput([4, 45, 15])).revisions;
    expect(only).toMatchObject({ idSpec: 'revid:45@game@local' });
  });

  it("names a file's revisions under an xlink in the xlinked repository, whose changesets they are", () => {
    // `cm history` of DiffWindowMockExtensions.cs in acme@acme@cloud, under the editor-plugin xlink to editorGUI, trimmed.
    const records = `
      <Revision>
        <RevisionSpec>/work/editor-plugin/DiffWindowMockExtensions.cs#cs:16828</RevisionSpec>
        <Branch>/main/task1008582</Branch>
        <CreationDate>2026-08-31T21:08:46+02:00</CreationDate>
        <RevisionType>txt</RevisionType>
        <ChangesetNumber>16828</ChangesetNumber>
        <Owner>jane@example.com</Owner>
        <Comment>Review 425296 comment d245ed6d</Comment>
        <Repository>editorGUI</Repository>
        <Server>acme@cloud</Server>
        <RepositorySpec><Server>acme@cloud</Server><Name>editorGUI</Name></RepositorySpec>
        <ItemId>425954</ItemId>
        <Size>627</Size>
      </Revision>`;
    const [only] = parse(records, formatOutput([16828, 425946, -1])).revisions;
    expect(only).toMatchObject({ changesetId: 16828, revisionId: 425946, repository: 'editorGUI@acme@cloud', idSpec: 'revid:425946@editorGUI@acme@cloud' });
  });

  it('falls back to the path spec for a revision without an id', () => {
    const [only] = parse(revision(4, 'Mention UI'), '').revisions;
    expect(only).toMatchObject({ revisionId: -1, parentRevisionId: -1, idSpec: 'README.md#cs:4' });
  });

  it('handles a single revision and binary files', () => {
    const [only] = parse(revision(3, '123', 'bin'), formatOutput([3, 37, -1])).revisions;
    expect(only).toMatchObject({ changesetId: 3, revisionId: 37, comment: '123', itemType: 'binaryFile' });
  });

  it('lists moves and removals apart, with what cm says they did', () => {
    const history = parse(
      revision(1, 'Initial import') + move(2, 'Moved from /README.txt to /README.md') + revision(5, 'Rename and edit') + move(5, 'Moved from /README.md to /docs/README.md'),
      formatOutput([1, 15, -1], [5, 50, 15]),
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
  it("reads the workspace's file, or the item of a revision in its repository", () => {
    expect(itemHistoryTarget('/work', 'src/a.cs')).toBe(join('/work', 'src', 'a.cs'));
    expect(itemHistoryTarget('/work', 'src/a.cs', { revisionId: 432251, repository: 'editorGUI@acme@cloud' })).toBe('rev:revid:432251@editorGUI@acme@cloud');
  });
});

describe('parseWorkspaceItem', () => {
  it("reads the item's own revision and repository, listed before a directory's children", () => {
    expect(parseWorkspaceItem(formatOutput([100, 'rep:game@local']))).toEqual({ revisionId: 100, repository: 'game@local' });
    expect(parseWorkspaceItem(formatOutput([102, 'rep:lib@AcmeStudio@unity'], [100, 'rep:lib@AcmeStudio@unity']))).toEqual({
      revisionId: 102,
      repository: 'lib@AcmeStudio@unity',
    });
  });

  it('finds no revision for an item the workspace has none of, and nothing in no output', () => {
    expect(parseWorkspaceItem(formatOutput([-1, 'rep:game@local']))).toEqual({ repository: 'game@local' });
    expect(parseWorkspaceItem('')).toBeUndefined();
  });
});

describe('withServerOf', () => {
  const record = (server: string) => parseHistoryRecords(xml(revision(4, 'Fix')).replace('<Server>local</Server>', `<Server>${server}</Server>`));

  it("names a Unity organization's server, which cm history --xml prints by its id, after the item's repository", () => {
    const named = withServerOf(record(UNITY_ORGANIZATION.byId), 'game@AcmeStudio@unity');

    expect(parseItemHistory(named, formatOutput([4, 45, 15])).revisions[0]).toMatchObject({ repository: 'game@AcmeStudio@unity', idSpec: 'revid:45@game@AcmeStudio@unity' });
  });

  it('leaves servers by name, and the id when no repository names it', () => {
    expect(withServerOf(record('acme@cloud'), 'game@AcmeStudio@unity')[0]?.Server).toBe('acme@cloud');
    expect(withServerOf(record(UNITY_ORGANIZATION.byId), undefined)[0]?.Server).toBe(UNITY_ORGANIZATION.byId);
  });
});
