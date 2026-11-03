import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { BranchNamesCache } from '../cm/BranchNamesCache';
import { roundTripDate } from '../cm/findQuery';
import { formatOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient } from '../cm/testing/fakeCmClient';
import { createBranchExplorerService } from './branchExplorerService';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const IN_WORKSPACE = workspacePlace(WORKSPACE);
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

    await service.load(IN_WORKSPACE, { includeHidden: false });

    expect(commands.map(({ via, args }) => [via, args[1]])).toEqual([
      ['query', 'branch'],
      ['query', 'branch'],
      ['query', 'changeset'],
      ['execute', 'merge'],
      ['query', 'label'],
    ]);
    expect(commands.every((command) => command.options.cwd === WORKSPACE)).toBe(true);
  });

  it('reads each find as records as they arrive, never holding its whole output: a big repository answers with hundreds of MB', async () => {
    const { service, commands } = branchExplorer();

    await service.load(IN_WORKSPACE, { includeHidden: false });

    expect(commands.map((command) => command.readsRecords)).toEqual([true, true, true, true, true]);
  });

  it('draws the visible branches, changesets, merge links and labels', async () => {
    const { service } = branchExplorer();

    const graph = await service.load(IN_WORKSPACE, { includeHidden: false });

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

    const graph = await service.load(IN_WORKSPACE, { includeHidden: true });

    expect(graph.branches.map((branch) => [branch.name, branch.isHidden])).toContainEqual(['/main/old', true]);
    expect(lines().find((line) => line.startsWith('find changeset'))).toContain("ignorehidden = 'true'");
  });

  it('remembers every branch name, hidden ones too, so code reviews name their branches without asking cm', async () => {
    const { service, branchNames, commands } = branchExplorer();

    await service.load(IN_WORKSPACE, { includeHidden: false });

    expect(await branchNames.resolve(IN_WORKSPACE, [21, 37, 99])).toEqual(
      new Map([
        [21, '/main/old'],
        [37, '/main/task1'],
      ]),
    );
    expect(commands).toHaveLength(5);
  });
});

describe('Branch Explorer of a repository explored without a workspace', () => {
  it('reads the graph with the same five finds, each naming the repository, outside every workspace', async () => {
    const { service, commands, branchNames } = branchExplorer();
    const onRepository = repositoryPlace('game@local');

    await service.load(onRepository, { sinceDate: '2026-07-01', includeHidden: false });

    const since = `where date >= '${roundTripDate('2026-07-01')}' on repository 'game@local'`;
    expect(commands.map(({ args }) => args[2])).toEqual(["on repository 'game@local'", "where hidden = 'true' on repository 'game@local'", since, since, since]);
    expect(commands.every(({ options }) => options.outsideWorkspaces)).toBe(true);
    expect(await branchNames.resolve(onRepository, [21])).toEqual(new Map([[21, '/main/old']]));
  });
});

describe('Branch Explorer rules', () => {
  function rules() {
    const fake = fakeCmClient({
      'find branch': ({ line }) => (line.includes("owner = 'ana'") ? formatOutput(['/main'], ['/main/task1']) : cmFails("Error: Unknown field 'nmae'.")),
      'find changeset': formatOutput(['5'], ['7']),
      'find label': formatOutput(['v1.0']),
    });
    const branchNames = new BranchNamesCache(async () => []);
    return { ...fake, service: createBranchExplorerService(serviceContext(fake.cm), { branchNames }) };
  }

  it('asks one quick find per rule, each read as records, in the workspace', async () => {
    const { service, commands } = rules();

    await service.matchRules(IN_WORKSPACE, [
      { object: 'branch', condition: "owner = 'ana'" },
      { object: 'changeset', condition: "date >= '2026-01-01'" },
    ]);

    expect(commands.map(({ via, args }) => [via, args[1], args[2]])).toEqual([
      ['query', 'branch', "where owner = 'ana'"],
      ['query', 'changeset', "where date >= '2026-01-01'"],
    ]);
    expect(commands.every((command) => command.readsRecords && command.options.cwd === WORKSPACE)).toBe(true);
  });

  it('answers what each rule matched, in the order asked', async () => {
    const { service } = rules();

    const answers = await service.matchRules(IN_WORKSPACE, [
      { object: 'label', condition: "name like 'v%'" },
      { object: 'branch', condition: "owner = 'ana'" },
      { object: 'changeset', condition: "owner = 'ana'" },
    ]);

    expect(answers).toEqual([{ matched: ['v1.0'] }, { matched: ['/main', '/main/task1'] }, { matched: ['5', '7'] }]);
  });

  it('answers the error of a condition cm refuses, and still the others', async () => {
    const { service } = rules();

    const answers = await service.matchRules(IN_WORKSPACE, [
      { object: 'branch', condition: "nmae = 'x'" },
      { object: 'label', condition: "name like 'v%'" },
    ]);

    expect(answers[0]).toEqual({ error: expect.stringContaining("Unknown field 'nmae'") });
    expect(answers[1]).toEqual({ matched: ['v1.0'] });
  });

  it('asks nothing without rules', async () => {
    const { service, commands } = rules();

    expect(await service.matchRules(IN_WORKSPACE, [])).toEqual([]);
    expect(commands).toHaveLength(0);
  });

  it('names the repository when explored without a workspace', async () => {
    const { service, commands } = rules();

    await service.matchRules(repositoryPlace('game@local'), [{ object: 'label', condition: "name like 'v%'" }]);

    expect(commands[0].args[2]).toBe("where name like 'v%' on repository 'game@local'");
    expect(commands[0].options.outsideWorkspaces).toBe(true);
  });
});
