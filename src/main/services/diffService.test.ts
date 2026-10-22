import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DiffEntry } from '@shared/domain/diff';
import { DIFF_FORMAT } from '../cm/diffEntries';
import { FOUND_PARENTS } from '../cm/xlinkSides';
import { formatOutput, recordsOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { TREE_ITEMS } from '../cm/treeItems';
import { HandedOverDiffs } from '../window/HandedOverDiffs';
import { createDiffService } from './diffService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

const PLAYER_CHANGED = formatOutput(['C', '"/src/player.cs"', '""', '13', '37', 'F', '"game@local"']);

function diff(output = '') {
  const fake = fakeCmClient({ diff: output });
  return { ...fake, service: createDiffService(serviceContext(fake.cm)) };
}

describe('diff entries', () => {
  it('reads what a changeset changed with one quick cm diff, formatted, never opening a diff tool', async () => {
    const { service, commands } = diff(PLAYER_CHANGED);

    const entries = await service.entries(WORKSPACE, { kind: 'changeset', changesetId: 37 });

    expect(commands).toMatchObject([{ via: 'query', args: ['diff', 'cs:37', '--repositorypaths', `--format=${DIFF_FORMAT}`], options: { cwd: WORKSPACE } }]);
    expect(entries).toEqual([
      { status: 'changed', path: 'src/player.cs', oldPath: undefined, itemType: 'file', baseRevisionId: 13, revisionId: 37, repository: 'game@local' },
    ]);
  });

  it('names each kind of target as cm takes it', async () => {
    const { service, commands } = diff(PLAYER_CHANGED);

    await service.entries(WORKSPACE, { kind: 'branch', branch: '/main/task1' });
    await service.entries(WORKSPACE, { kind: 'shelve', shelveId: 3 });
    await service.entries(WORKSPACE, { kind: 'range', fromSpec: 'cs:10', toSpec: 'lb:v1.0' });

    expect(commands.map((command) => command.args.slice(1, -2))).toEqual([['br:/main/task1', '--integration'], ['sh:3'], ['cs:10', 'lb:v1.0']]);
  });
});

describe('a diff handed to a page window', () => {
  it("is read once without cm, from what the window that opened it already read; again, it asks cm", async () => {
    const handedOverDiffs = new HandedOverDiffs();
    const fake = fakeCmClient({ diff: PLAYER_CHANGED });
    const service = createDiffService(serviceContext(fake.cm, { handedOverDiffs }));
    const target = { kind: 'changeset', changesetId: 37 } as const;
    const handed: DiffEntry[] = [{ status: 'added', path: 'src/enemy.cs', itemType: 'file', baseRevisionId: -1, revisionId: 38, repository: 'game@local' }];
    handedOverDiffs.hand(WORKSPACE, target, handed);

    expect(await service.entries(WORKSPACE, target)).toEqual(handed);
    expect(fake.commands).toEqual([]);
    await service.entries(WORKSPACE, target);
    expect(fake.lines()).toEqual([`diff cs:37 --repositorypaths --format=${DIFF_FORMAT}`]);
  });
});

describe('branch diff entries', () => {
  const TASK = { kind: 'branch', branch: '/main/task1' } as const;

  it('shows only what the branch brings to its parent, leaving out what it merged from it, with one quick cm diff', async () => {
    const { service, lines, linesVia } = diff(PLAYER_CHANGED);

    const entries = await service.entries(WORKSPACE, TASK);

    expect(lines()).toEqual([`diff br:/main/task1 --integration --repositorypaths --format=${DIFF_FORMAT}`]);
    expect(linesVia('execute')).toEqual([]);
    expect(entries.map((entry) => entry.path)).toEqual(['src/player.cs']);
  });

  it('shows everything a branch changed once it is all merged into its parent, where nothing is left pending', async () => {
    const fake = fakeCmClient({ 'diff br:/main/task1 --integration': '', 'diff br:/main/task1': PLAYER_CHANGED });
    const service = createDiffService(serviceContext(fake.cm));

    const entries = await service.entries(WORKSPACE, TASK);

    expect(fake.lines()).toEqual([
      `diff br:/main/task1 --integration --repositorypaths --format=${DIFF_FORMAT}`,
      `diff br:/main/task1 --repositorypaths --format=${DIFF_FORMAT}`,
    ]);
    expect(entries.map((entry) => entry.path)).toEqual(['src/player.cs']);
  });
});

/** `cm ls` of the folder holding `plugins/unity-plugin` at a point, the xlink pointing at `changeset`. */
const pluginsAt = (changeset: number) =>
  recordsOutput(
    TREE_ITEMS,
    { name: '.', wkpath: '/plugins', type: 'dir' },
    { name: `unity-plugin -> wxlink -> / ${changeset}@unityGUI@ [relative] codice@cloud`, wkpath: '/plugins/unity-plugin', type: 'dir' },
  );

const unityGUI = (changeset: number) => ({ writable: true, path: '/', changeset, repository: 'unityGUI', server: 'codice@cloud' });

const XLINK = { path: 'plugins/unity-plugin', status: 'changed' } as const;

function xlinks(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createDiffService(serviceContext(fake.cm)) };
}

describe('Where a changed xlink points', () => {
  it("reads a branch's head and where it started: one cm find, then one quick cm ls of the xlink's folder at each", async () => {
    const { service, commands } = xlinks({
      find: recordsOutput(FOUND_PARENTS, { parent: 279866 }),
      'ls /plugins --tree=cs:279866': pluginsAt(17309),
      'ls /plugins --tree=br:/main/task1': pluginsAt(17361),
    });

    const sides = await service.xlinkSides(WORKSPACE, { kind: 'branch', branch: '/main/task1' }, XLINK);

    expect(sides).toEqual({ before: unityGUI(17309), after: unityGUI(17361) });
    expect(commands.map((command) => [command.via, command.args.slice(0, 3)])).toEqual([
      ['query', ['find', 'changeset', "where branch = '/main/task1' order by changesetid asc limit 1"]],
      ['query', ['ls', '/plugins', '--tree=br:/main/task1']],
      ['query', ['ls', '/plugins', '--tree=cs:279866']],
    ]);
    expect(commands.every((command) => command.options.cwd === WORKSPACE)).toBe(true);
  });

  it('reads a moved xlink before the move at its old path', async () => {
    const { service, commands } = xlinks({ 'ls /old --tree=cs:10': pluginsAt(1).replaceAll('/plugins', '/old'), 'ls /plugins --tree=cs:12': pluginsAt(2) });

    const sides = await service.xlinkSides(WORKSPACE, { kind: 'range', fromSpec: 'cs:10', toSpec: 'cs:12' }, { ...XLINK, oldPath: 'old/unity-plugin', status: 'moved' });

    expect(sides).toEqual({ before: unityGUI(1), after: unityGUI(2) });
    expect(commands).toHaveLength(2);
  });

  it('reads an added xlink only after, and finds none where its folder is not in the tree', async () => {
    const { service, commands } = xlinks({ 'ls /plugins --tree=cs:37': cmFails("Can't resolve the selector for the item /plugins") });

    const sides = await service.xlinkSides(WORKSPACE, { kind: 'changeset', changesetId: 37 }, { ...XLINK, status: 'added' });

    expect(sides).toEqual({ before: null, after: null });
    expect(commands.map((command) => command.args[0])).toEqual(['ls']);
  });

  it("runs nothing for a shelve, whose tree cm ls can't read", async () => {
    const { service, commands } = xlinks({});

    expect(await service.xlinkSides(WORKSPACE, { kind: 'shelve', shelveId: 3 }, XLINK)).toEqual({ before: null, after: null });
    expect(commands).toEqual([]);
  });

  it('fails on any other cm error', async () => {
    const { service } = xlinks({ find: recordsOutput(FOUND_PARENTS, { parent: 36 }), ls: cmFails('The server is not available') });

    await expect(service.xlinkSides(WORKSPACE, { kind: 'changeset', changesetId: 37 }, XLINK)).rejects.toThrow('The server is not available');
  });
});
