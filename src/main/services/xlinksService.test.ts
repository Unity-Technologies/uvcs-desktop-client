import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NewXlink } from '@shared/domain/xlinks';
import { describe, expect, it, vi } from 'vitest';
import { FOUND_LABELS } from '../cm/foundObjects';
import { recordsOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { TREE_ITEMS } from '../cm/treeItems';
import type { SwitchContext } from './ServiceContext';
import { readingFileOption } from './testing/readingFileOption';
import { serviceContext } from './testing/serviceContext';
import { createXlinksService } from './xlinksService';

vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }));

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const LIB = join(WORKSPACE, 'code', 'lib');

function xlinks(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createXlinksService(serviceContext(fake.cm), {} as SwitchContext) };
}

describe('Reading an xlink’s rules', () => {
  it('asks cm xlink --show once, in the workspace’s cm shell', async () => {
    const { service, commands } = xlinks({
      'xlink --show': `${LIB} --> wxlink:lib:/@2@lib@local\nBranch expansion rules:\nbr:/main@game@local -> br:/main/dev@lib@local [user-defined]\n`,
    });

    const rules = await service.rules(WORKSPACE, 'code/lib');

    expect(rules).toEqual([{ from: '/main', to: '/main/dev', userDefined: true }]);
    expect(commands).toMatchObject([{ via: 'query', args: ['xlink', '--show', LIB], options: { cwd: WORKSPACE } }]);
  });
});

describe('Creating an xlink', () => {
  const ENGINE: NewXlink = {
    path: 'code/lib',
    repository: 'lib@local',
    point: { kind: 'branch', branch: '/main' },
    writable: true,
    relativeServer: false,
    folder: '/',
    rules: [{ from: '/main/task', to: '/main/dev' }],
  };
  const CHECKED_IN = `CI_START\nAD ${LIB}\nCHANGESET cs:3@br:/main@game@local (mount:'/')\n`;

  it('creates it, checks in it alone with the comment, and loads its files with an update of its folder', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=', CHECKED_IN);
    const { service, commands } = xlinks({ xlink: '', checkin: answer, update: '' });

    expect(await service.create(WORKSPACE, ENGINE, 'Add the engine', 'op-1')).toEqual({ kind: 'loaded', changesetId: 3 });

    expect(commands).toMatchObject([
      { via: 'query', args: ['xlink', '-w', LIB, '/', 'br:/main@lib@local', 'br:/main/task-br:/main/dev'] },
      { via: 'execute', args: ['checkin', LIB, '--all', '--dependencies', `-commentsfile=${seen.file}`, '--machinereadable', '--symlink'], options: { cwd: WORKSPACE } },
      { via: 'execute', args: ['update', LIB, '--machinereadable', '--noinput', '--dontmerge'], options: { cwd: WORKSPACE } },
    ]);
    expect(seen.content).toBe('Add the engine');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('fails with cm’s words, as when the folder holding it isn’t controlled', async () => {
    const { service, commands } = xlinks({ xlink: cmFails(`${join(WORKSPACE, 'code')} is not in a workspace.`) });

    const created = service.create(WORKSPACE, { ...ENGINE, writable: false, rules: [] }, 'c', 'op-1');

    await expect(created).rejects.toThrow('is not in a workspace');
    expect(commands).toHaveLength(1);
  });

  it('keeps the xlink as a pending change when it can’t be checked in, and says why', async () => {
    const { service, ran } = xlinks({ xlink: '', checkin: cmFails('The server is unreachable.') });

    expect(await service.create(WORKSPACE, ENGINE, 'c', 'op-1')).toEqual({ kind: 'notCheckedIn', reason: 'The server is unreachable' });
    expect(ran('update')).toBe(false);
  });

  it('says its files didn’t load once it is checked in, and why', async () => {
    const { service } = xlinks({ xlink: '', checkin: CHECKED_IN, update: cmFails('The server is unreachable.'), status: '' });

    expect(await service.create(WORKSPACE, ENGINE, 'c', 'op-1')).toEqual({ kind: 'notLoaded', changesetId: 3, reason: 'The server is unreachable' });
  });
});

describe('Editing an xlink', () => {
  it('points it elsewhere, drops the rules that go and then adds the new ones: a changed rule keeps its branch', async () => {
    const { service, lines, commands } = xlinks({ 'xlink -e': '', 'xlink --deleterules': '', 'xlink --addrules': '' });

    await service.edit(WORKSPACE, {
      path: 'code/lib',
      repository: 'lib@local',
      point: { kind: 'changeset', changeset: 9 },
      removedRules: [{ from: '/main', to: '/main/dev' }],
      addedRules: [{ from: '/main', to: '/main/x' }, { from: '/main/task', to: '/main/dev' }],
    });

    expect(lines()).toEqual([
      `xlink -e ${LIB} cs:9@lib@local`,
      `xlink --deleterules ${LIB} br:/main-br:/main/dev`,
      `xlink --addrules ${LIB} br:/main-br:/main/x br:/main/task-br:/main/dev`,
    ]);
    expect(commands.every((command) => command.via === 'query')).toBe(true);
  });

  it('puts the rules it dropped back when adding the new ones fails, so the xlink is as it was and Save can be tried again', async () => {
    const { service, lines } = xlinks({
      'xlink --deleterules': '',
      [`xlink --addrules ${LIB} br:/main-br:/main/x`]: cmFails("The specified branch br:/main/x@lib@local can't be found."),
      [`xlink --addrules ${LIB} br:/main-br:/main/dev`]: '',
    });

    const edited = service.edit(WORKSPACE, { path: 'code/lib', repository: 'lib@local', removedRules: [{ from: '/main', to: '/main/dev' }], addedRules: [{ from: '/main', to: '/main/x' }] });

    await expect(edited).rejects.toThrow("can't be found");
    expect(lines()).toEqual([`xlink --deleterules ${LIB} br:/main-br:/main/dev`, `xlink --addrules ${LIB} br:/main-br:/main/x`, `xlink --addrules ${LIB} br:/main-br:/main/dev`]);
  });

  it('asks only for what changed', async () => {
    const { service, lines } = xlinks({ 'xlink --addrules': '' });

    await service.edit(WORKSPACE, { path: 'code/lib', repository: 'lib@local', removedRules: [], addedRules: [{ from: '/main', to: '/main/dev' }] });

    expect(lines()).toEqual([`xlink --addrules ${LIB} br:/main-br:/main/dev`]);
  });
});

describe('Browsing the folders of the repository an xlink points to', () => {
  it('lists a changeset’s or a branch’s tree with no command first', async () => {
    const { service, commands } = xlinks({});

    expect(await service.treePoint(WORKSPACE, 'lib@local', { kind: 'branch', branch: '/main' })).toBe('br:/main@lib@local');
    expect(commands).toEqual([]);
  });

  it('reads a label’s tree at its changeset, which one cm find of that repository names', async () => {
    const label = { id: 9, name: 'v1.0', changeset: 1, branch: '/main', comment: '', owner: 'ana', date: '2026-10-23T10:00:00+02:00', repname: 'lib', repserver: 'local' };
    const { service, commands } = xlinks({ 'find label': recordsOutput(FOUND_LABELS, label) });

    expect(await service.treePoint(WORKSPACE, 'lib@local', { kind: 'label', label: 'v1.0' })).toBe('cs:1@lib@local');
    expect(commands).toMatchObject([{ via: 'query', args: expect.arrayContaining(["where name = 'v1.0' on repository 'lib@local'"]) }]);
  });

  it('says when there is no such label there', async () => {
    const { service } = xlinks({ 'find label': '' });

    await expect(service.treePoint(WORKSPACE, 'lib@local', { kind: 'label', label: 'v9' })).rejects.toThrow('There is no label v9 in lib@local.');
  });

  it('lists one folder’s folders with one quick cm ls of the tree', async () => {
    const listing = recordsOutput(TREE_ITEMS, { name: '.', wkpath: '/', type: 'dir' }, { name: 'Shaders', wkpath: '/Shaders', type: 'dir' }, { name: 'a.txt', wkpath: '/a.txt', type: 'txt' });
    const { service, commands } = xlinks({ 'ls /': listing });

    expect(await service.folders(WORKSPACE, 'cs:2@lib@local', '/')).toEqual(['/Shaders']);
    expect(commands).toMatchObject([{ via: 'query', args: ['ls', '/', '--tree=cs:2@lib@local', expect.any(String)], options: { cwd: WORKSPACE } }]);
  });
});
