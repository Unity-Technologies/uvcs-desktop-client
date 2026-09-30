import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import type { PendingChange } from '@shared/domain/pendingChanges';
import { change, changesetsFound, diffRecord, NOTHING_FOUND, pendingStatus, statusHeader } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { findUpdateBlockers, findUpdateConflicts, incomingChangesetsArgs, readIncomingChanges, readIncomingSummary, summarizeIncoming } from './incoming';

function incoming(path: string, status: DiffEntry['status'], itemType: DiffEntry['itemType'] = 'file'): DiffEntry {
  return { path, status, itemType, baseRevisionId: 10, revisionId: 20, repository: 'game@local' };
}

function local(path: string, kinds: PendingChange['kinds']): PendingChange {
  return { path, kinds, itemType: 'file', size: 0, lastModified: '' };
}

describe('findUpdateBlockers', () => {
  it('reports local changes to items the branch deleted or moved', () => {
    const moved: DiffEntry = { ...incoming('src/new-name.txt', 'moved'), oldPath: 'src/old-name.txt' };
    expect(
      findUpdateBlockers([incoming('src/gone.txt', 'deleted'), moved, incoming('src/a.txt', 'changed')], [
        local('src/gone.txt', ['changed']),
        local('src/old-name.txt', ['checkedOut']),
        local('src/a.txt', ['changed']),
      ]),
    ).toEqual(['src/gone.txt', 'src/old-name.txt']);
  });
});

describe('findUpdateConflicts', () => {
  it('reports files changed both locally and on the branch', () => {
    const conflicts = findUpdateConflicts(
      [incoming('src/a.txt', 'changed'), incoming('src/b.txt', 'changed'), incoming('img.png', 'changed', 'binaryFile')],
      [local('src/a.txt', ['checkedOut', 'changed']), local('img.png', ['changed'])],
    );
    expect(conflicts).toEqual([
      { path: 'src/a.txt', isBinary: false, baseRevisionId: 10, incomingRevisionId: 20, repository: 'game@local' },
      { path: 'img.png', isBinary: true, baseRevisionId: 10, incomingRevisionId: 20, repository: 'game@local' },
    ]);
  });

  it('ignores local changes that do not touch the content', () => {
    expect(findUpdateConflicts([incoming('src/a.txt', 'changed')], [local('src/a.txt', ['moved'])])).toEqual([]);
  });

  it('ignores incoming additions and directories', () => {
    expect(findUpdateConflicts([incoming('new.txt', 'added'), incoming('src', 'changed', 'directory')], [local('src', ['changed'])])).toEqual([]);
  });
});

describe('the incoming summary', () => {
  it('asks only for the numbers and owners of the changesets after the loaded one on the branch', () => {
    const [find, object, where, format, ...rest] = incomingChangesetsArgs("/main/o'brien", 41);
    expect([find, object, where, rest]).toEqual(['find', 'changeset', "where changesetid > 41 and branch = '/main/o''brien'", ['--nototal']]);
    expect(format).toMatch(/^--format=\{changesetid\}.\{owner\}/);
  });

  it('counts them, takes the newest as the head and names each author once, newest first', () => {
    const incoming = [
      { id: 43, owner: 'bob' },
      { id: 45, owner: 'ana' },
      { id: 44, owner: 'bob' },
    ];
    expect(summarizeIncoming('/main', 41, incoming)).toEqual({ branch: '/main', loadedChangeset: 41, headChangeset: 45, changesetCount: 3, authors: ['ana', 'bob'] });
    expect(summarizeIncoming('/main', 41, [])).toEqual({ branch: '/main', loadedChangeset: 41, headChangeset: 41, changesetCount: 0, authors: [] });
  });
});

describe('incoming off a branch', () => {
  // cm reports a workspace switched to shelve 3 as on changeset -3.
  const ON_SHELVE = statusHeader('3', { type: 'Shelve', changeset: -3, repository: 'sandbox' });

  it('asks the server nothing', async () => {
    const { cm, lines } = fakeCmClient();
    expect(await readIncomingSummary(cm, '/w', null)).toEqual({ branch: null, changesetCount: 0, authors: [] });
    expect(lines()).toEqual([]);
  });

  it('on a shelve reads only the status: no changeset query starts from the shelve', async () => {
    const { cm, lines } = fakeCmClient({ status: ON_SHELVE });
    expect(await readIncomingChanges(cm, '/w')).toEqual({ branch: null, changesetCount: 0, authors: [], changesets: [], files: [], conflicts: [], blockedPaths: [] });
    expect(lines().map((line) => line.split(' ')[0])).toEqual(['status']);
  });
});

describe('readIncomingChanges', () => {
  const branchMovedOn = (changesets: string) =>
    fakeCmClient({
      'status --header --xml': statusHeader('/main', { changeset: 41 }),
      'find changeset': changesets,
      'diff cs:41 cs:43': diffRecord('C', 'src/a.txt', { base: 10, revision: 20 }) + diffRecord('D', 'src/old.txt', { revision: 11 }),
      'status --xml --controlledchanged --changed': pendingStatus(change('CH', 'src/a.txt'), change('CH', 'src/old.txt')),
    });

  it('reads what came in with one find, one diff from the loaded changeset to the head, and the local changes', async () => {
    const { cm, lines } = branchMovedOn(changesetsFound('/main', { id: 43, owner: 'ana' }, { id: 42, owner: 'bob' }));

    const changes = await readIncomingChanges(cm, '/work');

    expect(changes).toMatchObject({ branch: '/main', loadedChangeset: 41, headChangeset: 43, changesetCount: 2, authors: ['ana', 'bob'] });
    expect(changes.conflicts.map((conflict) => conflict.path)).toEqual(['src/a.txt']);
    expect(changes.blockedPaths).toEqual(['src/old.txt']);
    expect(lines().filter((line) => line.startsWith('find'))).toEqual(["find changeset where changesetid > 41 and branch = '/main' order by changesetid desc --xml --nototal"]);
  });

  it('asks nothing more once nothing came in', async () => {
    const { cm, lines } = branchMovedOn(NOTHING_FOUND);

    expect(await readIncomingChanges(cm, '/work')).toMatchObject({ changesetCount: 0, files: [], conflicts: [], blockedPaths: [] });
    expect(lines().some((line) => line.startsWith('diff'))).toBe(false);
  });
});
