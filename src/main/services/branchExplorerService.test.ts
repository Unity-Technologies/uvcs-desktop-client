import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BranchNamesCache } from '../cm/BranchNamesCache';
import { formatOutput } from '../cm/testing/cmOutput';
import { fakeCmClient } from '../cm/testing/fakeCmClient';
import { createBranchExplorerService } from './branchExplorerService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const DAY = '2026-09-01T10:00:00+02:00';

const BRANCHES = formatOutput(['3', '/main', '', 'ana', DAY, '5', ''], ['37', '/main/task1', '/main', 'ana', DAY, '5', 'Task']);
const HIDDEN = formatOutput(['21', '/main/old', '/main', 'bob', DAY, '2', '']);
const CHANGESETS = formatOutput(['0', '/main', '-1', DAY, 'ana', ''], ['2', '/main/old', '0', DAY, 'bob', ''], ['5', '/main/task1', '0', DAY, 'ana', 'Jump']);
const MERGES = formatOutput(['merge', '2', '5'], ['cherrypick', '5', '0']);
const LABELS = formatOutput(['v1.0', '5', 'ana', DAY, 'First']);

function branchExplorer() {
  const fake = fakeCmClient({
    'find branch': ({ line }) => (line.includes("hidden = 'true'") ? HIDDEN : BRANCHES),
    'find changeset': CHANGESETS,
    'find merge': MERGES,
    'find label': LABELS,
  });
  const branchNames = new BranchNamesCache(async () => {
    throw new Error('The Branch Explorer read every branch already.');
  });
  return { ...fake, branchNames, service: createBranchExplorerService(serviceContext(fake.cm), { branchNames }) };
}

describe('Branch Explorer load', () => {
  it('reads the graph with five finds, the merges in a process of their own', async () => {
    const { service, commands } = branchExplorer();

    await service.load(WORKSPACE, { includeHidden: false });

    expect(commands.map(({ via, args }) => [via, args[1]])).toEqual([
      ['query', 'branch'],
      ['query', 'branch'],
      ['query', 'changeset'],
      ['execute', 'merge'],
      ['query', 'label'],
    ]);
    expect(commands.every((command) => command.options.cwd === WORKSPACE)).toBe(true);
  });

  it('draws the visible branches, changesets, merge links and labels', async () => {
    const { service } = branchExplorer();

    const graph = await service.load(WORKSPACE, { includeHidden: false });

    expect(graph.branches.map((branch) => branch.name)).toEqual(['/main', '/main/task1']);
    expect(graph.changesets.map((changeset) => changeset.id)).toEqual([0, 2, 5]);
    expect(graph.mergeLinks).toEqual([
      { type: 'merge', sourceChangeset: 2, destinationChangeset: 5 },
      { type: 'cherryPick', sourceChangeset: 5, destinationChangeset: 0 },
    ]);
    expect(graph.labels).toMatchObject([{ name: 'v1.0', changeset: 5 }]);
  });

  it('draws hidden branches too when asked, and reads their changesets', async () => {
    const { service, lines } = branchExplorer();

    const graph = await service.load(WORKSPACE, { includeHidden: true });

    expect(graph.branches.map((branch) => [branch.name, branch.isHidden])).toContainEqual(['/main/old', true]);
    expect(lines().find((line) => line.startsWith('find changeset'))).toContain("ignorehidden = 'true'");
  });

  it('remembers every branch name, hidden ones too, so code reviews name their branches without asking cm', async () => {
    const { service, branchNames, commands } = branchExplorer();

    await service.load(WORKSPACE, { includeHidden: false });

    expect(await branchNames.resolve(WORKSPACE, [21, 37, 99])).toEqual(
      new Map([
        [21, '/main/old'],
        [37, '/main/task1'],
      ]),
    );
    expect(commands).toHaveLength(5);
  });
});
