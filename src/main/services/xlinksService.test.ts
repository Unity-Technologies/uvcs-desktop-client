import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOUND_LABELS } from '../cm/foundObjects';
import { recordsOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { TREE_ITEMS } from '../cm/treeItems';
import { createXlinksService } from './xlinksService';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const LIB = join(WORKSPACE, 'code', 'lib');

function xlinks(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  return { ...fake, service: createXlinksService({ cm: fake.cm }) };
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
  it('runs one quick cm xlink at its folder in the workspace', async () => {
    const { service, commands } = xlinks({ xlink: '' });

    await service.create(WORKSPACE, {
      path: 'code/lib',
      repository: 'lib@local',
      point: { kind: 'branch', branch: '/main' },
      writable: true,
      relativeServer: false,
      folder: '/',
      rules: [{ from: '/main/task', to: '/main/dev' }],
    });

    expect(commands).toMatchObject([{ via: 'query', args: ['xlink', '-w', LIB, '/', 'br:/main@lib@local', 'br:/main/task-br:/main/dev'] }]);
  });

  it('fails with cm’s words, as when the folder holding it isn’t controlled', async () => {
    const { service } = xlinks({ xlink: cmFails(`${join(WORKSPACE, 'code')} is not in a workspace.`) });

    const created = service.create(WORKSPACE, { path: 'code/lib', repository: 'lib@local', point: { kind: 'changeset', changeset: 1 }, writable: false, relativeServer: false, folder: '/', rules: [] });

    await expect(created).rejects.toThrow('is not in a workspace');
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
