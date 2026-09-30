import { describe, expect, it } from 'vitest';
import { parseBranchNames, readBranchNames } from './branchNames';
import { formatOutput } from './testing/cmOutput';
import { fakeCmClient } from './testing/fakeCmClient';

const F = '\u001f';
const R = '\u001e';

describe('parseBranchNames', () => {
  it('reads the id and the name of each branch', () => {
    expect(parseBranchNames(`4${F}/main${R}\n37${F}/main/task1${R}\n`)).toEqual([
      { id: 4, name: '/main' },
      { id: 37, name: '/main/task1' },
    ]);
  });
});

describe('readBranchNames', () => {
  it('reads every branch id and name, hidden ones too, with two light queries', async () => {
    const { cm, commands } = fakeCmClient({
      'find branch': ({ line }) => (line.includes("hidden = 'true'") ? formatOutput(['21', '/main/old']) : formatOutput(['4', '/main'], ['37', '/main/task1'])),
    });

    expect(await readBranchNames(cm, '/wk')).toEqual([
      { id: 4, name: '/main' },
      { id: 37, name: '/main/task1' },
      { id: 21, name: '/main/old' },
    ]);
    expect(commands.map(({ via, args, options }) => [via, args, options.cwd])).toEqual([
      ['query', ['find', 'branch', `--format={id}${F}{name}${R}`, '--nototal'], '/wk'],
      ['query', ['find', 'branch', "where hidden = 'true'", `--format={id}${F}{name}${R}`, '--nototal'], '/wk'],
    ]);
  });
});
