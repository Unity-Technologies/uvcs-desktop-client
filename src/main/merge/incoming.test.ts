import { describe, expect, it, vi } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import type { PendingChange } from '@shared/domain/pendingChanges';
import type { CmClient } from '../cm/CmClient';
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
  // `cm status --header --xml` of a workspace switched to shelve 3: cm reports it as changeset -3.
  const ON_SHELVE = `<?xml version="1.0" encoding="utf-8"?>
<StatusOutput>
  <WorkspaceStatus><Status><RepSpec><Server>local</Server><Name>sandbox</Name></RepSpec><Changeset>-3</Changeset></Status></WorkspaceStatus>
  <WkConfigType>Shelve</WkConfigType>
  <WkConfigName>3@sandbox@local</WkConfigName>
</StatusOutput>`;
  const cmAnswering = (output: string) => {
    const query = vi.fn(async (_args: string[]) => output);
    return { cm: { query } as unknown as CmClient, query };
  };

  it('asks the server nothing', async () => {
    const { cm, query } = cmAnswering('');
    expect(await readIncomingSummary(cm, '/w', null)).toEqual({ branch: null, changesetCount: 0, authors: [] });
    expect(query).not.toHaveBeenCalled();
  });

  it('on a shelve reads only the status: no changeset query starts from the shelve', async () => {
    const { cm, query } = cmAnswering(ON_SHELVE);
    expect(await readIncomingChanges(cm, '/w')).toEqual({ branch: null, changesetCount: 0, authors: [], changesets: [], files: [], conflicts: [], blockedPaths: [] });
    expect(query.mock.calls.map(([args]) => args[0])).toEqual(['status']);
  });
});
