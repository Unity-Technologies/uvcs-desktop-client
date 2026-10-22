import { describe, expect, it } from 'vitest';
import { FOUND_CHANGESETS } from '../cm/foundObjects';
import { change, changesetsFound, diffRecord, formatOutput, foundLine, pendingStatus, statusHeader } from '../cm/testing/cmOutput';
import { INCOMING_CHANGESETS_PAGE } from '@shared/domain/incoming';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { incomingChangesetsArgs, INCOMING_CHECK_LIMIT, readIncomingChangesetPage, readIncomingChanges, readIncomingSummary, summarizeIncoming } from './incoming';

describe('the incoming summary', () => {
  it('asks only for the numbers and owners of the newest changesets after the loaded one on the branch, one more than it counts', () => {
    const [find, object, where, format, ...rest] = incomingChangesetsArgs("/main/o'brien", 41);
    expect([find, object, where, rest]).toEqual([
      'find',
      'changeset',
      `where changesetid > 41 and branch like '/main/o%brien' order by changesetid desc limit ${INCOMING_CHECK_LIMIT + 1}`,
      ['--nototal'],
    ]);
    expect(format).toMatch(/^--format=\{changesetid\}.\{owner\}/);
  });

  it('counts them, takes the newest as the head and names each author once, newest first', () => {
    const incoming = [
      { id: 43, owner: 'bob' },
      { id: 45, owner: 'ana' },
      { id: 44, owner: 'bob' },
    ];
    expect(summarizeIncoming('/main', 41, incoming, 100)).toEqual({
      branch: '/main',
      loadedChangeset: 41,
      headChangeset: 45,
      changesetCount: 3,
      countCapped: false,
      authors: ['ana', 'bob'],
    });
    expect(summarizeIncoming('/main', 41, [], 100)).toEqual({ branch: '/main', loadedChangeset: 41, headChangeset: 41, changesetCount: 0, countCapped: false, authors: [] });
  });

  it('stops counting at its limit: one more changeset than the limit says there are more', () => {
    const incoming = [{ id: 50, owner: 'ana' }, { id: 49, owner: 'bob' }, { id: 48, owner: 'eve' }];
    expect(summarizeIncoming('/main', 41, incoming.slice(0, 2), 2)).toMatchObject({ headChangeset: 50, changesetCount: 2, countCapped: false });
    expect(summarizeIncoming('/main', 41, incoming, 2)).toMatchObject({ headChangeset: 50, changesetCount: 2, countCapped: true, authors: ['ana', 'bob'] });
  });

  it('costs one bounded find however far behind the workspace is', async () => {
    const behind = formatOutput(...Array.from({ length: INCOMING_CHECK_LIMIT + 1 }, (_, index) => [1000 - index, 'ana']));
    const { cm, commands, lines, linesVia } = fakeCmClient({ 'find changeset': behind });

    const summary = await readIncomingSummary(cm, '/w', { branch: '/main', loadedChangeset: 41 });

    expect(summary).toMatchObject({ headChangeset: 1000, changesetCount: INCOMING_CHECK_LIMIT, countCapped: true, authors: ['ana'] });
    expect(lines()).toHaveLength(1);
    expect(linesVia('query')).toEqual(lines());
    expect(commands[0]?.readsRecords).toBe(true);
  });
});

describe('incoming off a branch', () => {
  // cm reports a workspace switched to shelve 3 as on changeset -3.
  const ON_SHELVE = statusHeader('3', { type: 'Shelve', changeset: -3, repository: 'sandbox' });

  it('asks the server nothing', async () => {
    const { cm, lines } = fakeCmClient();
    expect(await readIncomingSummary(cm, '/w', null)).toEqual({ branch: null, changesetCount: 0, countCapped: false, authors: [] });
    expect(lines()).toEqual([]);
  });

  it('on a shelve reads only the status: no changeset query starts from the shelve', async () => {
    const { cm, lines } = fakeCmClient({ status: ON_SHELVE });
    expect(await readIncomingChanges(cm, '/w')).toEqual({
      branch: null,
      changesetCount: 0,
      countCapped: false,
      authors: [],
      changesets: [],
      moreChangesets: false,
      files: [],
      conflicts: [],
      blockedPaths: [],
    });
    expect(lines().map((line) => line.split(' ')[0])).toEqual(['status']);
  });
});

describe('readIncomingChanges', () => {
  const branchMovedOn = (changesets: string) =>
    fakeCmClient({
      'status --header --xml': statusHeader('/main', { changeset: 41 }),
      'find changeset': changesets,
      'diff cs:41 cs:43': diffRecord('C', 'src/a.txt', { base: 10, revision: 20 }) + diffRecord('D', 'src/old.txt', { revision: 11 }),
      'status --controlledchanged --changed': pendingStatus('/work', change('CH', 'src/a.txt'), change('CH', 'src/old.txt')),
    });

  it('reads what came in with one find, one diff from the loaded changeset to the head, and the local changes', async () => {
    const { cm, lines } = branchMovedOn(changesetsFound('/main', { id: 43, owner: 'ana' }, { id: 42, owner: 'bob' }));

    const changes = await readIncomingChanges(cm, '/work');

    expect(changes).toMatchObject({ branch: '/main', loadedChangeset: 41, headChangeset: 43, changesetCount: 2, countCapped: false, authors: ['ana', 'bob'], moreChangesets: false });
    expect(changes.conflicts.map((conflict) => conflict.path)).toEqual(['src/a.txt']);
    expect(changes.blockedPaths).toEqual(['src/old.txt']);
    expect(lines().filter((line) => line.startsWith('find'))).toEqual([
      foundLine(FOUND_CHANGESETS, `where changesetid > 41 and branch = '/main' order by changesetid desc limit ${INCOMING_CHANGESETS_PAGE + 1}`),
    ]);
  });

  it('reads only the newest page of changesets however many came in, and says older ones remain', async () => {
    const many = Array.from({ length: INCOMING_CHANGESETS_PAGE + 1 }, (_, index) => ({ id: 43 + INCOMING_CHANGESETS_PAGE - index, owner: 'ana' }));
    const { cm } = fakeCmClient({
      'status --header --xml': statusHeader('/main', { changeset: 41 }),
      'find changeset': changesetsFound('/main', ...many),
      [`diff cs:41 cs:${43 + INCOMING_CHANGESETS_PAGE}`]: diffRecord('C', 'src/a.txt', { base: 10, revision: 20 }),
      'status --controlledchanged --changed': pendingStatus('/work'),
    });

    const changes = await readIncomingChanges(cm, '/work');

    expect(changes.changesets).toHaveLength(INCOMING_CHANGESETS_PAGE);
    expect(changes).toMatchObject({ headChangeset: 43 + INCOMING_CHANGESETS_PAGE, changesetCount: INCOMING_CHANGESETS_PAGE, countCapped: true, moreChangesets: true });
  });

  it('asks nothing more once nothing came in', async () => {
    const { cm, lines } = branchMovedOn('');

    expect(await readIncomingChanges(cm, '/work')).toMatchObject({ changesetCount: 0, files: [], conflicts: [], blockedPaths: [] });
    expect(lines().some((line) => line.startsWith('diff'))).toBe(false);
  });
});

describe('a page of incoming changesets', () => {
  const request = { branch: '/main', loadedChangeset: 41, limit: 2 };

  it('reads the newest after the loaded one, one more than asked to tell whether older ones remain', async () => {
    const { cm, linesVia, lines } = fakeCmClient({ 'find changeset': changesetsFound('/main', { id: 45, owner: 'ana' }, { id: 44, owner: 'bob' }, { id: 43, owner: 'eve' }) });

    const page = await readIncomingChangesetPage(cm, '/w', request);

    expect(page.changesets.map((changeset) => changeset.id)).toEqual([45, 44]);
    expect(page.more).toBe(true);
    expect(linesVia('query')).toEqual([foundLine(FOUND_CHANGESETS, "where changesetid > 41 and branch = '/main' order by changesetid desc limit 3")]);
    expect(lines()).toHaveLength(1);
  });

  it('reads the ones older than a changeset for the next page, and the last says none remain', async () => {
    const { cm, lines } = fakeCmClient({ 'find changeset': changesetsFound('/main', { id: 43, owner: 'eve' }) });

    const page = await readIncomingChangesetPage(cm, '/w', { ...request, olderThan: 44 });

    expect(page).toMatchObject({ more: false });
    expect(page.changesets.map((changeset) => changeset.id)).toEqual([43]);
    expect(lines()).toEqual([foundLine(FOUND_CHANGESETS, "where changesetid > 41 and changesetid < 44 and branch = '/main' order by changesetid desc limit 3")]);
  });
});
