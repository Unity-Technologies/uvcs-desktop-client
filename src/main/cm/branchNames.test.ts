import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { readBranchName, readBranchNames } from './branchNames';
import { formatOutput } from './testing/cmOutput';
import { fakeCmClient } from './testing/fakeCmClient';

const F = '\u001f';
const R = '\u001e';

describe('readBranchNames', () => {
  it('reads every branch id and name, hidden ones too, with two light queries', async () => {
    const { cm, commands } = fakeCmClient({
      'find branch': ({ line }) => (line.includes("hidden = 'true'") ? formatOutput(['21', '/main/old']) : formatOutput(['4', '/main'], ['37', '/main/task1'])),
    });

    expect(await readBranchNames(cm, workspacePlace('/wk'))).toEqual([
      { id: 4, name: '/main' },
      { id: 37, name: '/main/task1' },
      { id: 21, name: '/main/old' },
    ]);
    expect(commands.map(({ via, args, options, readsRecords }) => [via, args, options.cwd, readsRecords])).toEqual([
      ['query', ['find', 'branch', `--format={id}${F}{name}${R}`, '--nototal'], '/wk', true],
      ['query', ['find', 'branch', "where hidden = 'true'", `--format={id}${F}{name}${R}`, '--nototal'], '/wk', true],
    ]);
  });

  it('names the repository in both queries when no workspace tells cm which', async () => {
    const { cm, commands } = fakeCmClient({ 'find branch': formatOutput(['4', '/main']) });

    await readBranchNames(cm, repositoryPlace('game@local'));

    expect(commands.map(({ args, options }) => [args[2], options])).toEqual([
      ["on repository 'game@local'", { outsideWorkspaces: true, server: 'local' }],
      ["where hidden = 'true' on repository 'game@local'", { outsideWorkspaces: true, server: 'local' }],
    ]);
  });
});

describe('readBranchName', () => {
  it('reads one branch by its id with one light query', async () => {
    const { cm, commands } = fakeCmClient({ 'find branch': formatOutput(['37', '/main/task1']) });

    expect(await readBranchName(cm, workspacePlace('/wk'), 37)).toEqual({ id: 37, name: '/main/task1' });
    expect(commands.map(({ via, args, readsRecords }) => [via, args, readsRecords])).toEqual([
      ['query', ['find', 'branch', 'where id = 37', `--format={id}${F}{name}${R}`, '--nototal'], true],
    ]);
  });

  it('asks for a hidden branch only when the visible ones lack it', async () => {
    const { cm, commands } = fakeCmClient({ 'find branch': ({ line }) => (line.includes("hidden = 'true'") ? formatOutput(['21', '/main/old']) : '') });

    expect(await readBranchName(cm, workspacePlace('/wk'), 21)).toEqual({ id: 21, name: '/main/old' });
    expect(commands.map(({ args }) => args[2])).toEqual(['where id = 21', "where id = 21 and hidden = 'true'"]);
  });

  it('finds none for a branch deleted since', async () => {
    const { cm } = fakeCmClient({ 'find branch': '' });

    expect(await readBranchName(cm, workspacePlace('/wk'), 99)).toBeUndefined();
  });

  it('names the repository when no workspace tells cm which', async () => {
    const { cm, commands } = fakeCmClient({ 'find branch': formatOutput(['37', '/main/task1']) });

    await readBranchName(cm, repositoryPlace('game@local'), 37);

    expect(commands.map(({ args, options }) => [args[2], options])).toEqual([["where id = 37 on repository 'game@local'", { outsideWorkspaces: true, server: 'local' }]]);
  });
});
