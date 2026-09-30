import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DIFF_FORMAT } from '../cm/diffEntries';
import { fakeCmClient, formatOutput } from '../cm/testing/fakeCmClient';
import { createDiffService } from './diffService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function diff(output = '') {
  const fake = fakeCmClient({ diff: output });
  return { ...fake, service: createDiffService(serviceContext(fake.cm)) };
}

describe('diff entries', () => {
  it('reads what a changeset changed with one quick cm diff, formatted, never opening a diff tool', async () => {
    const { service, commands } = diff(formatOutput(['C', '"/src/player.cs"', '""', '13', '37', 'F', '"game@local"']));

    const entries = await service.entries(WORKSPACE, { kind: 'changeset', changesetId: 37 });

    expect(commands).toMatchObject([{ via: 'query', args: ['diff', 'cs:37', '--repositorypaths', `--format=${DIFF_FORMAT}`], options: { cwd: WORKSPACE } }]);
    expect(entries).toEqual([
      { status: 'changed', path: 'src/player.cs', oldPath: undefined, itemType: 'file', baseRevisionId: 13, revisionId: 37, repository: 'game@local' },
    ]);
  });

  it('names each kind of target as cm takes it', async () => {
    const { service, commands } = diff();

    await service.entries(WORKSPACE, { kind: 'branch', branch: '/main/task1' });
    await service.entries(WORKSPACE, { kind: 'shelve', shelveId: 3 });
    await service.entries(WORKSPACE, { kind: 'range', fromSpec: 'cs:10', toSpec: 'lb:v1.0' });

    expect(commands.map((command) => command.args.slice(1, -2))).toEqual([['br:/main/task1'], ['sh:3'], ['cs:10', 'lb:v1.0']]);
  });
});
