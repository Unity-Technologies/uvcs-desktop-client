import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings } from '@shared/domain/settings';
import type { CmClient } from '../cm/CmClient';
import type { OperationContext } from '../operations/OperationTracker';
import type { SettingsStore } from '../settings/SettingsStore';
import type { LeftChangesFinder } from './leftChanges';
import { shelveAndUndo, shelvedAwayChanges } from './shelveAndUndo';
import { SwitchShelveRecords } from './switchShelveRecords';
import { applyShelveCleanly, createVerifiedShelve } from './switchShelves';

vi.mock('./switchShelves', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./switchShelves')>()),
  createVerifiedShelve: vi.fn(async () => ({ id: 12, repository: 'eco@local' })),
  applyShelveCleanly: vi.fn(async () => ({ kind: 'applied', count: 2 })),
}));

const header = `<?xml version="1.0" encoding="utf-8"?>
<StatusOutput>
  <WorkspaceStatus><Status><RepSpec><Server>local</Server><Name>eco</Name></RepSpec><Changeset>1</Changeset></Status></WorkspaceStatus>
  <WkConfigType>Branch</WkConfigType>
  <WkConfigName>/main/task1@eco@local</WkConfigName>
</StatusOutput>`;

const change = (type: string, path: string, merge = ''): string =>
  `<Change><Type>${type}</Type><Path>${path}</Path><OldPath /><MergesInfo>${merge}</MergesInfo><SimilarityPerUnit>0</SimilarityPerUnit><Size>3</Size><RevisionType>enTextFile</RevisionType><LastModified>2026-09-25T08:26:09+02:00</LastModified></Change>`;

const status = (changes: string[], changelist = ''): string =>
  `<?xml version="1.0" encoding="utf-8"?><StatusOutput><WorkspaceStatus><Status><Changeset>1</Changeset></Status></WorkspaceStatus>${changelist}<Changes>${changes.join('')}</Changes></StatusOutput>`;

/** A workspace on /main/task1 with a changed file, an added one and another changed file left out of the shelve. */
function workspaceWith(workspacePath: string, { failUndo = false, merging = false } = {}) {
  const executed: string[][] = [];
  const pending = [change('CH', 'src/a.txt', merging ? 'Merge from 3' : ''), change('AD', 'src/new.txt'), change('CH', 'src/other.txt')];
  const cm = {
    async query(args: string[]) {
      const command = args.join(' ');
      if (command === 'status --header --xml') return header;
      if (args[0] === 'getworkspacefrompath') return 'work\u001fa0411612-d36e-4eca-b9b5-97acad5969ea\u001e\n';
      if (command === 'status --xml --private') return status([change('PR', 'src/new.txt')]);
      if (args[0] === 'status') return status(pending);
      throw new Error(`Unexpected command: cm ${command}`);
    },
    async execute(args: string[]) {
      executed.push(args);
      if (failUndo && args[0] === 'undo') throw new Error('The file is in use.');
      return '';
    },
  } as unknown as CmClient;

  let settings = { switchShelves: [] } as unknown as AppSettings;
  const store = {
    get: () => settings,
    update: (changes: Partial<AppSettings>) => (settings = { ...settings, ...changes }),
  } as unknown as SettingsStore;
  const records = new SwitchShelveRecords(store);
  const finish = vi.fn(async () => {});
  const deps = { cm, records, leftChanges: { finish } as unknown as LeftChangesFinder, backupsRoot: join(workspacePath, '..', 'backups') };
  return { deps, executed, records, finish };
}

const context: OperationContext = {
  signal: new AbortController().signal,
  reportProgress: () => {},
  beginStep: () => {},
  progressOf: () => () => {},
};

let workspacePath: string;

beforeEach(async () => {
  vi.mocked(createVerifiedShelve).mockClear();
  workspacePath = join(await mkdtemp(join(tmpdir(), 'uvcs-shelve-')), 'wk');
  await mkdir(join(workspacePath, 'src'), { recursive: true });
  await writeFile(join(workspacePath, 'src/new.txt'), 'added');
});

describe('shelveAndUndo', () => {
  it('undoes only what it shelved, and moves the added files aside so the workspace is as before the changes', async () => {
    const { deps, executed, records } = workspaceWith(workspacePath);

    expect(await shelveAndUndo(deps, workspacePath, ['src/a.txt', 'src/new.txt'], 'Half done', context)).toEqual({ shelveId: 12, count: 2 });
    expect(createVerifiedShelve).toHaveBeenCalledWith(
      deps.cm,
      workspacePath,
      [expect.objectContaining({ path: 'src/a.txt' }), expect.objectContaining({ path: 'src/new.txt' })],
      'Half done',
      context,
      ['src/a.txt', 'src/new.txt'],
    );
    expect(executed).toEqual([['undo', join(workspacePath, 'src/a.txt'), join(workspacePath, 'src/new.txt'), '--symlink']]);
    expect(existsSync(join(workspacePath, 'src/new.txt'))).toBe(false);
    expect(records.find({ shelveId: 12, repository: 'eco@local' })).toMatchObject({
      reason: 'shelve',
      paths: ['src/a.txt', 'src/new.txt'],
      backup: { paths: ['src/new.txt'] },
    });
  });

  it('shelves and undoes the whole workspace when no paths are given', async () => {
    const { deps, executed } = workspaceWith(workspacePath);

    await shelveAndUndo(deps, workspacePath, null, 'Everything', context);
    expect(vi.mocked(createVerifiedShelve).mock.calls[0]![5]).toBeUndefined();
    expect(executed).toEqual([['undo', '-r', workspacePath, '--symlink']]);
  });

  it("refuses a merge in progress before shelving anything: a shelve can't hold it", async () => {
    const { deps } = workspaceWith(workspacePath, { merging: true });

    await expect(shelveAndUndo(deps, workspacePath, ['src/a.txt'], 'Merge', context)).rejects.toThrow(/merge in progress/);
    expect(createVerifiedShelve).not.toHaveBeenCalled();
  });

  it('puts the changes back when undoing them fails', async () => {
    const { deps, finish } = workspaceWith(workspacePath, { failUndo: true });

    await expect(shelveAndUndo(deps, workspacePath, ['src/a.txt'], 'Half done', context)).rejects.toThrow(
      "Couldn't undo the shelved changes: The file is in use. Your changes were put back.",
    );
    expect(applyShelveCleanly).toHaveBeenCalled();
    expect(finish).toHaveBeenCalledWith(workspacePath, expect.objectContaining({ shelveId: 12 }));
  });
});

describe('shelvedAwayChanges', () => {
  it('takes the given paths only, or every pending change', () => {
    const changes = [{ path: 'a' }, { path: 'b' }] as Parameters<typeof shelvedAwayChanges>[0];
    expect(shelvedAwayChanges(changes, ['b'])).toEqual([{ path: 'b' }]);
    expect(shelvedAwayChanges(changes, null)).toBe(changes);
  });
});
