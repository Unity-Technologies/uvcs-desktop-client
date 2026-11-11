import { describe, expect, it } from 'vitest';
import type { PartialIncomingItem } from '@shared/domain/incoming';
import { change, formatOutput, pendingStatus, statusHeader } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { readIncomingChanges } from './incoming';
import { headListingArgs } from './partialIncoming';

const WORKSPACE = '/work';

// The sandbox's partial workspace (`partial-operations.sh`): it loaded the root and Code; the head changed Ship.cs and
// added Hull.cs in Code, and changed Audio, which the workspace left out.
const LOADED = formatOutput(['3', '5', '-1', 'dir', '', '0', ''], ['22', '23', '-1', 'dir', 'Code', '1', ''], ['27', '15', '-1', 'txt', 'Code\\Engine.cs', '1', ''], ['28', '16', '-1', 'txt', 'Code\\Ship.cs', '1', '']);
const ROOT_ON_HEAD = [['3', '40', 'dir', '/', '3'], ['20', '42', 'dir', '/Audio', '3'], ['22', '41', 'dir', '/Code', '3']];
const CODE_ON_HEAD = [['22', '41', 'dir', '/Code', '3'], ['27', '15', 'txt', '/Code/Engine.cs', '1'], ['43', '38', 'txt', '/Code/Hull.cs', '3'], ['28', '34', 'txt', '/Code/Ship.cs', '2']];

const partialWorkspace = (headListing: CmAnswer) =>
  fakeCmClient({
    'status --header --xml': statusHeader('/main', { changeset: -1 }),
    'status --controlledchanged --changed': pendingStatus(WORKSPACE, change('CH', 'Code/Ship.cs')),
    'ls -R': LOADED,
    'ls /': headListing,
    'ls /Src': headListing,
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
    ]);
    expect(listings.every((command) => command.readsRecords)).toBe(true);
    expect(commands.some((command) => command.args[0] === 'diff')).toBe(false);
  });

  it('lists the head again without a loaded folder it no longer has, which reads as removed', async () => {
    const answer: CmAnswer = ({ args }) =>
      args.includes('/Code')
        ? cmFails(`${formatOutput(...ROOT_ON_HEAD.filter(([, , , path]) => path !== '/Code'))}Can't resolve the selector for the item /Code\n`)
        : formatOutput(...ROOT_ON_HEAD.filter(([, , , path]) => path !== '/Code'));
    const { cm, lines } = partialWorkspace(answer);

    const changes = await readIncomingChanges(cm, WORKSPACE);

    expect(changes).toMatchObject({ partial: true, items: [item({ kind: 'removed', path: 'Code', isDirectory: true, conflict: true, loadedRevisionId: 23 })] });
    expect(lines().filter((line) => line.startsWith('ls /'))).toHaveLength(2);
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
    expect(headListings.map((command) => command.args.filter((arg) => arg.startsWith('/')))).toEqual([['/', '/Code'], ['/'], ['/Src']]);
  });

  it('rethrows a failure that names no folder', async () => {
    const { cm } = partialWorkspace(cmFails('The server is unreachable'));

    await expect(readIncomingChanges(cm, WORKSPACE)).rejects.toThrow(/unreachable/);
  });

  it('reads every listing of a workspace whose folders overflow one command line, and finds what the last one holds', async () => {
    const folders = Array.from({ length: 2_000 }, (_, index) => `Assets/Folder number ${index}`);
    const loaded = formatOutput(['3', '5', '-1', 'dir', '', '0', ''], ...folders.map((path, index) => [String(100 + index), String(5_000 + index), '-1', 'dir', path, '1', '']));
    const headRowOf = (path: string) => (path === '/' ? ['3', '5', 'dir', '/', '3'] : (() => {
      const index = folders.indexOf(path.slice(1));
      return [String(100 + index), String(5_000 + index), 'dir', path, '1'];
    })());
    const lastFolder = `/${folders[folders.length - 1]}`;
    const { cm, commands } = fakeCmClient({
      'status --header --xml': statusHeader('/main', { changeset: -1 }),
      'status --controlledchanged --changed': pendingStatus(WORKSPACE),
      'ls -R': loaded,
      ls: ({ args }) => {
        const listed = args.filter((arg) => arg.startsWith('/'));
        const added = listed.includes(lastFolder) ? [['9000', '9001', 'txt', `${lastFolder}/New.cs`, '3']] : [];
        return formatOutput(...listed.map(headRowOf), ...added);
      },
      'find changeset': formatOutput([3]),
    });

    const changes = await readIncomingChanges(cm, WORKSPACE);

    expect(changes).toMatchObject({ items: [item({ kind: 'added', path: `${folders[folders.length - 1]}/New.cs`, headRevisionId: 9001 })] });
    const headListings = commands.filter((command) => command.args[0] === 'ls' && command.args[1] !== '-R');
    expect(headListings.length).toBeGreaterThan(1);
    expect(headListings.flatMap((command) => command.args.filter((arg) => arg.startsWith('/'))).sort()).toEqual(['/', ...folders.map((path) => `/${path}`)].sort());
  });

  it('splits the folders across listings when they would overflow one command line', () => {
    const folders = Array.from({ length: 2_000 }, (_, index) => `/Assets/Folder number ${index}`);
    const batches = headListingArgs(folders, '/main');
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.flatMap((args) => args.filter((arg) => arg.startsWith('/')))).toEqual(folders);
    expect(batches.every((args) => args[0] === 'ls' && args.includes('--tree=br:/main'))).toBe(true);
  });
});
