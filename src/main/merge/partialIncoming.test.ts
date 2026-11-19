import { describe, expect, it } from 'vitest';
import type { PartialIncomingItem } from '@shared/domain/incoming';
import { change, formatOutput, pendingStatus, statusHeader } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { readIncomingChanges } from './incoming';
import { isInFolders, loadedListingOf, MOST_FOLDERS_LISTED_ONE_BY_ONE, treeListingArgs, workspacePathOf } from './partialIncoming';

const WORKSPACE = '/work';

// The sandbox's partial workspace (`partial-operations.sh`): it loaded the root and Code; the head changed Ship.cs and
// added Hull.cs in Code, and changed Audio, which the workspace left out.
const LOADED = formatOutput(['3', '5', '-1', 'dir', '', '0', ''], ['22', '23', '-1', 'dir', 'Code', '1', ''], ['27', '15', '-1', 'txt', 'Code\\Engine.cs', '1', ''], ['28', '16', '-1', 'txt', 'Code\\Ship.cs', '1', '']);
const ROOT_ON_HEAD = [['3', '40', 'dir', '/', '3'], ['20', '42', 'dir', '/Audio', '3'], ['22', '41', 'dir', '/Code', '3']];
const CODE_WHEN_LOADED = formatOutput(['22', '23', 'dir', '/Code', '1'], ['27', '15', 'txt', '/Code/Engine.cs', '1'], ['28', '16', 'txt', '/Code/Ship.cs', '1']);
const CODE_ON_HEAD = [['22', '41', 'dir', '/Code', '3'], ['27', '15', 'txt', '/Code/Engine.cs', '1'], ['43', '38', 'txt', '/Code/Hull.cs', '3'], ['28', '34', 'txt', '/Code/Ship.cs', '2']];

const partialWorkspace = (headListing: CmAnswer) =>
  fakeCmClient({
    'status --header --xml': statusHeader('/main', { changeset: -1 }),
    'status --controlledchanged --changed': pendingStatus(WORKSPACE, change('CH', 'Code/Ship.cs')),
    'ls -R': LOADED,
    'ls /': headListing,
    'ls /Src': headListing,
    'ls /Code': CODE_WHEN_LOADED,
    'find changeset': formatOutput([3]),
  });

const item = (overrides: Partial<PartialIncomingItem> & Pick<PartialIncomingItem, 'kind' | 'path'>): PartialIncomingItem => ({
  isDirectory: false,
  conflict: false,
  loadedRevisionId: null,
  headRevisionId: null,
  ...overrides,
});

describe('incoming in a partial workspace', () => {
  it('names the items the branch head changes in the loaded folders, with the local changes they collide with', async () => {
    const { cm, commands } = partialWorkspace(formatOutput(...ROOT_ON_HEAD, ...CODE_ON_HEAD));

    expect(await readIncomingChanges(cm, WORKSPACE)).toEqual({
      branch: '/main',
      partial: true,
      headChangeset: 3,
      items: [
        item({ kind: 'added', path: 'Code/Hull.cs', headRevisionId: 38 }),
        item({ kind: 'changed', path: 'Code/Ship.cs', conflict: true, loadedRevisionId: 16, headRevisionId: 34 }),
      ],
    });
    const listings = commands.filter((command) => command.args[0] === 'ls');
    expect(listings.map((command) => command.args.filter((arg) => !arg.startsWith('--format=')))).toEqual([
      ['ls', '-R'],
      ['ls', '/', '/Code', '--tree=br:/main'],
      ['ls', '/', '--tree=cs:0'],
      ['ls', '/Code', '--tree=cs:1'],
    ]);
    expect(listings.every((command) => command.readsRecords)).toBe(true);
    expect(commands.some((command) => command.args[0] === 'diff')).toBe(false);
  });

  it('adds no folder that the loaded root already held, however new it looks, nor anything else in that root', async () => {
    // Big looks new (a greater item id, a later changeset), but the root as loaded (cs:0) already held it.
    const rootOnHead = [['3', '40', 'dir', '/', '3'], ['50', '44', 'dir', '/Big', '3'], ['51', '45', 'txt', '/Notes.txt', '3'], ['22', '41', 'dir', '/Code', '3']];
    const rootWhenLoaded = formatOutput(['3', '5', 'dir', '/', '0'], ['50', '6', 'dir', '/Big', '0'], ['22', '23', 'dir', '/Code', '1']);
    const answer: CmAnswer = ({ args }) => (args.includes('--tree=cs:0') ? rootWhenLoaded : formatOutput(...rootOnHead, ...CODE_ON_HEAD));
    const { cm, commands } = partialWorkspace(answer);

    const changes = await readIncomingChanges(cm, WORKSPACE);

    expect(changes).toMatchObject({ items: [item({ kind: 'added', path: 'Code/Hull.cs', headRevisionId: 38 }), item({ kind: 'changed', path: 'Code/Ship.cs', conflict: true, loadedRevisionId: 16, headRevisionId: 34 })] });
    const loadedListings = commands.filter((command) => command.args.some((arg) => arg.startsWith('--tree=cs:')));
    expect(loadedListings.map((command) => command.args.filter((arg) => !arg.startsWith('--format=')))).toEqual([
      ['ls', '/', '--tree=cs:0'],
      ['ls', '/Code', '--tree=cs:1'],
    ]);
  });

  it('adds what is new in a folder whose loaded listing also lists a subfolder it lists as loaded', async () => {
    // Code and Code/Sub each hold an item the workspace doesn't have, so both are listed as loaded, in one listing that
    // prints Sub twice: as Code's child and as itself. Sub is still one of Code's children, which Code held then.
    const loaded = formatOutput(['3', '5', '-1', 'dir', '', '0', ''], ['22', '23', '-1', 'dir', 'Code', '1', ''], ['27', '15', '-1', 'txt', 'Code\\Engine.cs', '1', ''], ['30', '31', '-1', 'dir', 'Code\\Sub', '1', ''], ['32', '33', '-1', 'txt', 'Code\\Sub\\A.cs', '1', '']);
    const onHead = formatOutput(
      ['3', '5', 'dir', '/', '0'],
      ['22', '41', 'dir', '/Code', '3'],
      ['27', '15', 'txt', '/Code/Engine.cs', '1'],
      ['60', '50', 'txt', '/Code/Hull.cs', '3'],
      ['30', '42', 'dir', '/Code/Sub', '3'],
      ['32', '33', 'txt', '/Code/Sub/A.cs', '1'],
      ['61', '51', 'txt', '/Code/Sub/Deep.cs', '3'],
    );
    const whenLoaded = formatOutput(['22', '23', 'dir', '/Code', '1'], ['27', '15', 'txt', '/Code/Engine.cs', '1'], ['30', '31', 'dir', '/Code/Sub', '1'], ['30', '31', 'dir', '/Code/Sub', '1'], ['32', '33', 'txt', '/Code/Sub/A.cs', '1']);
    const { cm } = fakeCmClient({
      'status --header --xml': statusHeader('/main', { changeset: -1 }),
      'status --controlledchanged --changed': pendingStatus(WORKSPACE),
      'ls -R': loaded,
      ls: ({ args }) => (args.includes('--tree=cs:1') ? whenLoaded : onHead),
      'find changeset': formatOutput([3]),
    });

    const changes = await readIncomingChanges(cm, WORKSPACE);

    expect(changes).toMatchObject({ items: [item({ kind: 'added', path: 'Code/Hull.cs', headRevisionId: 50 }), item({ kind: 'added', path: 'Code/Sub/Deep.cs', headRevisionId: 51 })] });
  });

  it('lists the head again without a loaded folder it no longer has, which reads as removed', async () => {
    const answer: CmAnswer = ({ args }) =>
      args.includes('/Code')
        ? cmFails(`${formatOutput(...ROOT_ON_HEAD.filter(([, , , path]) => path !== '/Code'))}Can't resolve the selector for the item /Code\n`)
        : formatOutput(...ROOT_ON_HEAD.filter(([, , , path]) => path !== '/Code'));
    const { cm, lines } = partialWorkspace(answer);

    const changes = await readIncomingChanges(cm, WORKSPACE);

    expect(changes).toMatchObject({ partial: true, items: [item({ kind: 'removed', path: 'Code', isDirectory: true, conflict: true, loadedRevisionId: 23 })] });
    expect(lines().filter((line) => line.startsWith('ls /') && line.includes('--tree=br:'))).toHaveLength(2);
  });

  it('lists a loaded folder the head moved at its new path, and reads its changes there', async () => {
    const rootWithSrc = [['3', '40', 'dir', '/', '3'], ['20', '42', 'dir', '/Audio', '3'], ['22', '41', 'dir', '/Src', '3']];
    const srcOnHead = CODE_ON_HEAD.map(([id, rev, type, path, cs]) => [id, rev, type, path.replace(/^\/Code/, '/Src'), cs]);
    const answer: CmAnswer = ({ args }) => {
      if (args.includes('/Code')) return cmFails(`${formatOutput(...rootWithSrc)}Can't resolve the selector for the item /Code\n`);
      return args.includes('/Src') ? formatOutput(...srcOnHead) : formatOutput(...rootWithSrc);
    };
    const { cm, commands } = partialWorkspace(answer);

    const changes = await readIncomingChanges(cm, WORKSPACE);

    expect(changes).toMatchObject({
      items: [
        item({ kind: 'moved', path: 'Src', oldPath: 'Code', isDirectory: true, loadedRevisionId: 23, headRevisionId: 41 }),
        item({ kind: 'added', path: 'Src/Hull.cs', headRevisionId: 38 }),
        item({ kind: 'changed', path: 'Src/Ship.cs', conflict: true, loadedRevisionId: 16, headRevisionId: 34 }),
      ],
    });
    const headListings = commands.filter((command) => command.args[0] === 'ls' && command.args[1] !== '-R');
    expect(headListings.map((command) => command.args.filter((arg) => arg.startsWith('/')))).toEqual([['/', '/Code'], ['/'], ['/Src'], ['/'], ['/Code']]);
  });

  it('never takes an xlink for a loaded folder the head moved, though it shares the item id of the root', async () => {
    // An xlink lists the item id of the xlinked repository's root, 3 here as for the workspace's own root: it is not
    // where the root went, so nothing is listed through it and nothing reads as moved.
    const xlinkOnHead = ['3', '90', 'dir', '/Lib', '7', 'Lib -> wxlink -> / 7@lib@ [relative] acme@cloud'];
    const { cm, commands } = partialWorkspace(formatOutput(...ROOT_ON_HEAD, xlinkOnHead, ...CODE_ON_HEAD));

    const changes = await readIncomingChanges(cm, WORKSPACE);

    expect(changes).toMatchObject({
      items: [
        item({ kind: 'added', path: 'Code/Hull.cs', headRevisionId: 38 }),
        item({ kind: 'changed', path: 'Code/Ship.cs', conflict: true, loadedRevisionId: 16, headRevisionId: 34 }),
      ],
    });
    const headListings = commands.filter((command) => command.args.some((arg) => arg === '--tree=br:/main'));
    expect(headListings.map((command) => command.args.filter((arg) => arg.startsWith('/')))).toEqual([['/', '/Code']]);
  });

  // A partial workspace that loaded one folder of an xlink, as `cm` prints it (a row inside an xlink at its workspace
  // path, the xlink's own row with its name): the head changed CarnageMain.cs, removed GetUnityToken.cs and added
  // SetEvictionConfig.cs, whose ids and changesets are pnunit's, not the workspace's. `folders` more folders loaded at
  // the root, unchanged, take it past what is listed one by one.
  const pnunitWorkspace = (folders = 0) => {
    const name = (changeset: number) => `03pnunit -> wxlink -> / ${changeset}@pnunit@ [relative] codice@cloud`;
    const more = Array.from({ length: folders }, (_, index) => ({ id: String(10 + index), revision: String(60 + index), path: `Folder ${index}` }));
    const loaded = formatOutput(
      ['2', '4', '-1', 'dir', '', '0', ''],
      ['2', '850279', '849994', 'dir', '03pnunit', '27890', '', name(27894)],
      ['101652', '850280', '-1', 'dir', '03pnunit\\test', '27890', ''],
      ['103262', '850281', '-1', 'dir', '03pnunit\\test\\carnagetest', '27890', ''],
      ['833552', '850282', '-1', 'dir', '03pnunit\\test\\carnagetest\\accelerator', '27890', ''],
      ['838894', '838899', '-1', 'txt', '03pnunit\\test\\carnagetest\\accelerator\\CarnageMain.cs', '27275', ''],
      ['838963', '845883', '-1', 'txt', '03pnunit\\test\\carnagetest\\accelerator\\GetUnityToken.cs', '27570', ''],
      ['833905', '834386', '-1', 'txt', '03pnunit\\test\\carnagetest\\accelerator\\Stats.cs', '27024', ''],
      ...more.map(({ id, revision, path }) => [id, revision, '-1', 'dir', path, '1', '']),
    );
    const head = formatOutput(
      ['2', '5000', 'dir', '/', '27898'],
      ['2', '850312', 'dir', '/03pnunit', '27898', name(27898)],
      ['101652', '850313', 'dir', '/03pnunit/test', '27898'],
      ['103262', '850314', 'dir', '/03pnunit/test/carnagetest', '27898'],
      ['833552', '850315', 'dir', '/03pnunit/test/carnagetest/accelerator', '27898'],
      ['838894', '849822', 'txt', '/03pnunit/test/carnagetest/accelerator/CarnageMain.cs', '27855'],
      ['849844', '850274', 'txt', '/03pnunit/test/carnagetest/accelerator/SetEvictionConfig.cs', '27889'],
      ['833905', '834386', 'txt', '/03pnunit/test/carnagetest/accelerator/Stats.cs', '27024'],
      ...more.map(({ id, revision, path }) => [id, revision, 'dir', `/${path}`, '1']),
    );
    const acceleratorWhenLoaded = formatOutput(
      ['833552', '850282', 'dir', '/test/carnagetest/accelerator', '27890'],
      ['838894', '838899', 'txt', '/test/carnagetest/accelerator/CarnageMain.cs', '27275'],
      ['838963', '845883', 'txt', '/test/carnagetest/accelerator/GetUnityToken.cs', '27570'],
      ['833905', '834386', 'txt', '/test/carnagetest/accelerator/Stats.cs', '27024'],
    );
    return fakeCmClient({
      'status --header --xml': statusHeader('/main', { changeset: -1 }),
      'status --controlledchanged --changed': pendingStatus(WORKSPACE),
      'ls -R': loaded,
      'ls /': head,
      'ls /test/carnagetest/accelerator': acceleratorWhenLoaded,
      'find changeset': formatOutput([27898]),
    });
  };
  const pnunitRepository = 'pnunit@codice@cloud';
  const pnunitIncoming = [
    item({ kind: 'changed', path: '03pnunit/test/carnagetest/accelerator/CarnageMain.cs', loadedRevisionId: 838899, headRevisionId: 849822, repository: pnunitRepository }),
    item({ kind: 'removed', path: '03pnunit/test/carnagetest/accelerator/GetUnityToken.cs', loadedRevisionId: 845883, repository: pnunitRepository }),
    item({ kind: 'added', path: '03pnunit/test/carnagetest/accelerator/SetEvictionConfig.cs', headRevisionId: 850274, repository: pnunitRepository }),
  ];
  const listingsOf = (commands: readonly { args: string[] }[], tree: string) =>
    commands.filter((command) => command.args.some((arg) => arg.startsWith(tree))).map((command) => command.args.filter((arg) => !arg.startsWith('--format=')));

  it('names what the head brings inside an xlink, reading what a folder held when loaded from the xlinked repository', async () => {
    const { cm, commands } = pnunitWorkspace();

    expect(await readIncomingChanges(cm, WORKSPACE)).toMatchObject({ items: pnunitIncoming });
    expect(listingsOf(commands, '--tree=cs:')).toEqual([['ls', '/test/carnagetest/accelerator', '--tree=cs:27890@pnunit@codice@cloud']]);
  });

  it('names what the head brings inside an xlink from the listing of the whole tree too', async () => {
    const { cm, commands } = pnunitWorkspace(MOST_FOLDERS_LISTED_ONE_BY_ONE);

    expect(await readIncomingChanges(cm, WORKSPACE)).toMatchObject({ items: pnunitIncoming });
    expect(listingsOf(commands, '--tree=br:')).toEqual([['ls', '/', '-R', '--tree=br:/main']]);
    expect(listingsOf(commands, '--tree=cs:')).toEqual([['ls', '/test/carnagetest/accelerator', '--tree=cs:27890@pnunit@codice@cloud']]);
  });

  it('rethrows a failure that names no folder', async () => {
    const { cm } = partialWorkspace(cmFails('The server is unreachable'));

    await expect(readIncomingChanges(cm, WORKSPACE)).rejects.toThrow(/unreachable/);
  });

  // A workspace that loaded more folders than are worth listing one by one: the root, Assets, and Assets/Folder 0…n.
  // The head changed the last folder (it holds a new file), and holds Audio, a folder the workspace left out.
  const manyFolders = Array.from({ length: MOST_FOLDERS_LISTED_ONE_BY_ONE }, (_, index) => `Assets/Folder ${index}`);
  const lastFolder = manyFolders[manyFolders.length - 1] ?? '';
  const lastFolderId = String(100 + manyFolders.length - 1);
  const manyFoldersLoaded = formatOutput(
    ['3', '5', '-1', 'dir', '', '0', ''],
    ['4', '6', '-1', 'dir', 'Assets', '1', ''],
    ...manyFolders.map((path, index) => [String(100 + index), String(500 + index), '-1', 'dir', path, '1', '']),
  );
  const manyFoldersOnHead = (lastFolderAt: string) => [
    ['3', '5', 'dir', '/', '1'],
    ['4', '6', 'dir', '/Assets', '1'],
    ...manyFolders.map((path, index) => (path === lastFolder ? [lastFolderId, '900', 'dir', `/${lastFolderAt}`, '3'] : [String(100 + index), String(500 + index), 'dir', `/${path}`, '1'])),
    ['900', '901', 'txt', `/${lastFolderAt}/New.cs`, '3'],
    ['50', '51', 'dir', '/Audio', '1'],
    ['52', '53', 'txt', '/Audio/Theme.ogg', '1'],
  ];
  const workspaceOfManyFolders = (headListing: CmAnswer, headOfFolder: (path: string) => string | undefined = () => undefined) =>
    fakeCmClient({
      'status --header --xml': statusHeader('/main', { changeset: -1 }),
      'status --controlledchanged --changed': pendingStatus(WORKSPACE),
      'ls -R': manyFoldersLoaded,
      'ls / -R --tree=br:/main': headListing,
      ls: ({ args }) => {
        if (args.includes('--tree=cs:1')) return formatOutput([lastFolderId, String(500 + manyFolders.length - 1), 'dir', `/${lastFolder}`, '1']);
        return headOfFolder(args[1] ?? '') ?? cmFails(`Unexpected listing: ${args.join(' ')}`);
      },
      'find changeset': formatOutput([3]),
    });

  it('reads the head of a workspace with many loaded folders in one listing of the whole tree, keeping what the loaded folders hold', async () => {
    const { cm, commands } = workspaceOfManyFolders(formatOutput(...manyFoldersOnHead(lastFolder)));

    const changes = await readIncomingChanges(cm, WORKSPACE);

    expect(changes).toMatchObject({ items: [item({ kind: 'added', path: `${lastFolder}/New.cs`, headRevisionId: 901 })] });
    const headListings = commands.filter((command) => command.args[0] === 'ls' && command.args.includes('--tree=br:/main'));
    expect(headListings.map((command) => command.args.filter((arg) => !arg.startsWith('--format=')))).toEqual([['ls', '/', '-R', '--tree=br:/main']]);
    // The whole tree takes seconds on a big repository: a process of its own, never a pooled shell the reads wait on.
    expect(headListings.every((command) => command.via === 'execute' && command.readsRecords)).toBe(true);
  });

  it('lists a loaded folder the head moved by its new path after the listing of the whole tree, and reads its changes there', async () => {
    const movedTo = 'Assets/Renamed';
    const onHead = manyFoldersOnHead(movedTo);
    const { cm, commands } = workspaceOfManyFolders(formatOutput(...onHead), (path) =>
      path === `/${movedTo}` ? formatOutput(...onHead.filter(([, , , row = '']) => row.startsWith(path))) : undefined,
    );

    const changes = await readIncomingChanges(cm, WORKSPACE);

    expect(changes).toMatchObject({
      items: [
        item({ kind: 'moved', path: movedTo, oldPath: lastFolder, isDirectory: true, loadedRevisionId: 500 + manyFolders.length - 1, headRevisionId: 900 }),
        item({ kind: 'added', path: `${movedTo}/New.cs`, headRevisionId: 901 }),
      ],
    });
    const headListings = commands.filter((command) => command.args.includes('--tree=br:/main'));
    expect(headListings.map((command) => command.args.filter((arg) => !arg.startsWith('--format=')))).toEqual([
      ['ls', '/', '-R', '--tree=br:/main'],
      ['ls', `/${movedTo}`, '--tree=br:/main'],
    ]);
  });

  it('lists as many loaded folders as are worth it one by one, never the whole tree', async () => {
    // The root and Folder 0…n, as many folders as are still listed one by one.
    const folders = Array.from({ length: MOST_FOLDERS_LISTED_ONE_BY_ONE - 1 }, (_, index) => `Folder ${index}`);
    const { cm, commands } = fakeCmClient({
      'status --header --xml': statusHeader('/main', { changeset: -1 }),
      'status --controlledchanged --changed': pendingStatus(WORKSPACE),
      'ls -R': formatOutput(['3', '5', '-1', 'dir', '', '0', ''], ...folders.map((path, index) => [String(100 + index), String(500 + index), '-1', 'dir', path, '1', ''])),
      'ls / -R': cmFails('The whole tree is never listed for this few folders'),
      'ls /': formatOutput(['3', '5', 'dir', '/', '1'], ...folders.map((path, index) => [String(100 + index), String(500 + index), 'dir', `/${path}`, '1'])),
      'find changeset': formatOutput([3]),
    });

    const changes = await readIncomingChanges(cm, WORKSPACE);

    expect(changes).toMatchObject({ items: [] });
    const headListings = commands.filter((command) => command.args.includes('--tree=br:/main'));
    expect(headListings.flatMap((command) => command.args.filter((arg) => arg.startsWith('/'))).sort()).toEqual(['/', ...folders.map((path) => `/${path}`)].sort());
    expect(headListings.some((command) => command.args.includes('-R'))).toBe(false);
  });

  it('splits the folders across listings when they would overflow one command line', () => {
    const folders = Array.from({ length: 2_000 }, (_, index) => `/Assets/Folder number ${index}`);
    const batches = treeListingArgs(folders, 'br:/main');
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flatMap((args) => args.filter((arg) => arg.startsWith('/')))).toEqual(folders);
    expect(batches.every((args) => args[0] === 'ls' && args.includes('--tree=br:/main'))).toBe(true);
  });
});

describe('loadedListingOf', () => {
  // `Libs` shows `/vendor` of the `thirdparty` repository: its folders are listed there, and read back under `Libs`.
  const xlinks = new Map([['Libs', { writable: true, path: '/vendor', changeset: 12, repository: 'thirdparty', server: 'acme@cloud' }]]);

  it('lists a folder outside every xlink in the repository of the workspace, at its own path', () => {
    const listing = loadedListingOf({ path: 'Code' }, 5, xlinks);

    expect(listing).toMatchObject({ tree: 'cs:5', serverPath: '/Code' });
    expect(workspacePathOf('Code/Ship.cs', listing)).toBe('Code/Ship.cs');
  });

  it('lists a folder inside an xlink in the xlinked repository, below the folder the xlink shows', () => {
    const listing = loadedListingOf({ path: 'Libs/zlib/src' }, 40, xlinks);

    expect(listing).toMatchObject({ tree: 'cs:40@thirdparty@acme@cloud', serverPath: '/vendor/zlib/src' });
    expect(workspacePathOf('vendor/zlib/src/inflate.c', listing)).toBe('Libs/zlib/src/inflate.c');
  });

  it('lists the xlink itself at the folder it shows', () => {
    const listing = loadedListingOf({ path: 'Libs' }, 40, xlinks);

    expect(listing).toMatchObject({ tree: 'cs:40@thirdparty@acme@cloud', serverPath: '/vendor' });
    expect(workspacePathOf('vendor', listing)).toBe('Libs');
    expect(workspacePathOf('vendor/README', listing)).toBe('Libs/README');
  });
});

describe('isInFolders', () => {
  // The workspace loaded the root, Code and Libs/zlib (inside the xlink Libs).
  const isListed = isInFolders(['/', '/Code', '/Libs/zlib']);

  it('keeps the loaded folders themselves, the root among them', () => {
    expect(['', 'Code', 'Libs/zlib'].map(isListed)).toEqual([true, true, true]);
  });

  it('keeps what lies right inside a loaded folder, a folder left out among it', () => {
    expect(['Audio', 'Code/Ship.cs', 'Libs', 'Libs/zlib/inflate.c'].map(isListed)).toEqual([true, true, true, true]);
  });

  it('drops what lies deeper, or inside a folder left out', () => {
    expect(['Code/Engine/Core.cs', 'Audio/Theme.ogg', 'Libs/png/png.c', 'Libs/zlib/src/deflate.c'].map(isListed)).toEqual([false, false, false, false]);
  });
});
