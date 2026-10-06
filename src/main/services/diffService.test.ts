import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIFF_FORMAT } from '../cm/diffEntries';
import { formatOutput } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
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
