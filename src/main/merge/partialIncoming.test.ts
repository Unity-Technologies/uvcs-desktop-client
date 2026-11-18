import { describe, expect, it } from 'vitest';
import type { PartialIncomingItem } from '@shared/domain/incoming';
import { change, formatOutput, pendingStatus, statusHeader } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { readIncomingChanges } from './incoming';
import { loadedListingOf, treeListingArgs, workspacePathOf } from './partialIncoming';

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

  it('names what the head brings inside an xlink, reading what a folder held when loaded from the xlinked repository', async () => {
    // A partial workspace that loaded one folder of an xlink: the head changed CarnageMain.cs, removed GetUnityToken.cs
    // and added SetEvictionConfig.cs, whose ids and changesets are pnunit's, not the workspace's.
    const name = (changeset: number) => `03pnunit -> wxlink -> / ${changeset}@pnunit@ [relative] codice@cloud`;
    const loaded = formatOutput(
      ['2', '4', '-1', 'dir', '', '0', ''],
      ['2', '850279', '849994', 'dir', '03pnunit', '27890', '', name(27894)],
      ['101652', '850280', '-1', 'dir', '03pnunit\\test', '27890', ''],
      ['103262', '850281', '-1', 'dir', '03pnunit\\test\\carnagetest', '27890', ''],
      ['833552', '850282', '-1', 'dir', '03pnunit\\test\\carnagetest\\accelerator', '27890', ''],
      ['838894', '838899', '-1', 'txt', '03pnunit\\test\\carnagetest\\accelerator\\CarnageMain.cs', '27275', ''],
      ['838963', '845883', '-1', 'txt', '03pnunit\\test\\carnagetest\\accelerator\\GetUnityToken.cs', '27570', ''],
      ['833905', '834386', '-1', 'txt', '03pnunit\\test\\carnagetest\\accelerator\\Stats.cs', '27024', ''],
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
    );
    const acceleratorWhenLoaded = formatOutput(
      ['833552', '850282', 'dir', '/test/carnagetest/accelerator', '27890'],
      ['838894', '838899', 'txt', '/test/carnagetest/accelerator/CarnageMain.cs', '27275'],
      ['838963', '845883', 'txt', '/test/carnagetest/accelerator/GetUnityToken.cs', '27570'],
      ['833905', '834386', 'txt', '/test/carnagetest/accelerator/Stats.cs', '27024'],
    );
    const { cm, commands } = fakeCmClient({
      'status --header --xml': statusHeader('/main', { changeset: -1 }),
      'status --controlledchanged --changed': pendingStatus(WORKSPACE),
      'ls -R': loaded,
      'ls /': head,
      'ls /test/carnagetest/accelerator': acceleratorWhenLoaded,
      'find changeset': formatOutput([27898]),
    });

    const changes = await readIncomingChanges(cm, WORKSPACE);

    const repository = 'pnunit@codice@cloud';
    expect(changes).toMatchObject({
      items: [
        item({ kind: 'changed', path: '03pnunit/test/carnagetest/accelerator/CarnageMain.cs', loadedRevisionId: 838899, headRevisionId: 849822, repository }),
        item({ kind: 'removed', path: '03pnunit/test/carnagetest/accelerator/GetUnityToken.cs', loadedRevisionId: 845883, repository }),
        item({ kind: 'added', path: '03pnunit/test/carnagetest/accelerator/SetEvictionConfig.cs', headRevisionId: 850274, repository }),
      ],
    });
    const loadedListings = commands.filter((command) => command.args.some((arg) => arg.startsWith('--tree=cs:')));
    expect(loadedListings.map((command) => command.args.filter((arg) => !arg.startsWith('--format=')))).toEqual([
      ['ls', '/test/carnagetest/accelerator', '--tree=cs:27890@pnunit@codice@cloud'],
    ]);
  });

  it('rethrows a failure that names no folder', async () => {
    const { cm } = partialWorkspace(cmFails('The server is unreachable'));

    await expect(readIncomingChanges(cm, WORKSPACE)).rejects.toThrow(/unreachable/);
  });

  it('reads every listing of a workspace whose folders overflow one command line, and finds what the last one holds', async () => {
    const folders = Array.from({ length: 2_000 }, (_, index) => `Assets/Folder number ${index}`);
    const loaded = formatOutput(['3', '5', '-1', 'dir', '', '0', ''], ...folders.map((path, index) => [String(100 + index), String(5_000 + index), '-1', 'dir', path, '1', '']));
    const lastFolder = `/${folders[folders.length - 1]}`;
    // The head changed the last folder (it holds a new file), so only it is listed as it was loaded.
    const headRowOf = (path: string, onHead: boolean) => (path === '/' ? ['3', '5', 'dir', '/', '3'] : (() => {
      const index = folders.indexOf(path.slice(1));
      const revision = onHead && path === lastFolder ? 9_002 : 5_000 + index;
      return [String(100 + index), String(revision), 'dir', path, '1'];
    })());
    const { cm, commands } = fakeCmClient({
      'status --header --xml': statusHeader('/main', { changeset: -1 }),
      'status --controlledchanged --changed': pendingStatus(WORKSPACE),
      'ls -R': loaded,
      ls: ({ args }) => {
        const listed = args.filter((arg) => arg.startsWith('/'));
        const onHead = args.includes('--tree=br:/main');
        const added = listed.includes(lastFolder) && onHead ? [['9000', '9001', 'txt', `${lastFolder}/New.cs`, '3']] : [];
        return formatOutput(...listed.map((path) => headRowOf(path, onHead)), ...added);
      },
      'find changeset': formatOutput([3]),
    });

    const changes = await readIncomingChanges(cm, WORKSPACE);

    expect(changes).toMatchObject({ items: [item({ kind: 'added', path: `${folders[folders.length - 1]}/New.cs`, headRevisionId: 9001 })] });
    const headListings = commands.filter((command) => command.args[0] === 'ls' && command.args.includes('--tree=br:/main'));
    expect(headListings.length).toBeGreaterThan(1);
    expect(headListings.flatMap((command) => command.args.filter((arg) => arg.startsWith('/'))).sort()).toEqual(['/', ...folders.map((path) => `/${path}`)].sort());
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
