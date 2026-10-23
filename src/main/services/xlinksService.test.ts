import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
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

  it('asks only for what changed', async () => {
    const { service, lines } = xlinks({ 'xlink --addrules': '' });

    await service.edit(WORKSPACE, { path: 'code/lib', repository: 'lib@local', removedRules: [], addedRules: [{ from: '/main', to: '/main/dev' }] });

    expect(lines()).toEqual([`xlink --addrules ${LIB} br:/main-br:/main/dev`]);
  });
});
