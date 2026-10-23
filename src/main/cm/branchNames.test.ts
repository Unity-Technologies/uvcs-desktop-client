import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { readBranchNames } from './branchNames';
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
      ["on repository 'game@local'", { outsideWorkspaces: true }],
      ["where hidden = 'true' on repository 'game@local'", { outsideWorkspaces: true }],
    ]);
  });
});
