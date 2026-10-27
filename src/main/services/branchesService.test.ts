import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAIN_BRANCH_GUID } from '@shared/domain/branch';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { BranchNamesCache } from '../cm/BranchNamesCache';
import { findQueryArgs, roundTripDate } from '../cm/findQuery';
import { FOUND_BRANCHES } from '../cm/foundObjects';
import { branchesFound, formatOutput, foundLine, recordsOutput } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { SettingsStore } from '../settings/SettingsStore';
import { cmHeaderReaders, WorkspaceHeaders } from '../workspace/WorkspaceHeaders';
import { createBranchesService } from './branchesService';
import { readingFileOption } from './testing/readingFileOption';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');
const IN_WORKSPACE = workspacePlace(WORKSPACE);

function branchRecord(id: number, name: string, date: string) {
  return {
    id: id,
    comment: '',
    date: date,
    owner: 'ana',
    name: name,
    parent: '/main',
    repname: 'game',
    repserver: 'local',
    changeset: 12,
    guid: `guid-${id}`,
  };
}

const TASK1 = branchRecord(37, '/main/task1', '2026-09-25T10:00:00+02:00');
const TASK2 = branchRecord(38, '/main/task2', '2026-09-27T10:00:00+02:00');
const OLD_HIDDEN = branchRecord(21, '/main/old', '2026-09-26T10:00:00+02:00');
const OTHER_TASK1 = { ...branchRecord(40, '/main/fix/task1', '2026-09-28T10:00:00+02:00'), parent: '/main/fix' };

function branches(answers: Record<string, CmAnswer>) {
  const fake = fakeCmClient(answers);
  const branchNames = new BranchNamesCache(async () => {
    throw new Error('The list read answers every name.');
  });
  return { ...fake, branchNames, service: createBranchesService(serviceContext(fake.cm), { branchNames }) };
}

const visibleOrHidden =
  (visible: string, hidden: string): CmAnswer =>
  ({ line }) =>
    line.includes("hidden = 'true'") ? hidden : visible;

describe('branch list', () => {
  it('lists visible branches with one quick cm find, newest first', async () => {
    const { service, commands } = branches({ 'find branch': recordsOutput(FOUND_BRANCHES, TASK2, TASK1) });

    const listed = await service.list(IN_WORKSPACE, { includeHidden: false });

    expect(commands).toMatchObject([
      { via: 'query', args: findQueryArgs(FOUND_BRANCHES, "where hidden = 'false' order by date desc"), options: { cwd: WORKSPACE }, readsRecords: true },
    ]);
    expect(listed.map((branch) => [branch.id, branch.name, branch.repository])).toEqual([
      [38, '/main/task2', 'game@local'],
      [37, '/main/task1', 'game@local'],
    ]);
  });

  // Written out, not built by the code under test: what cm is asked, field separators and all.
  it('asks cm for the fields it reads as records, dates in the round-trip format', async () => {
    const { service, lines } = branches({ 'find branch': '' });

    await service.list(IN_WORKSPACE, { includeHidden: false });

    expect(lines()).toEqual([
      "find branch where hidden = 'false' order by date desc " +
        '--format={id}\u001f{name}\u001f{parent}\u001f{comment}\u001f{owner}\u001f{date}\u001f{changeset}\u001f{guid}\u001f{repname}\u001f{repserver}\u001e ' +
        '--dateformat=o --nototal',
    ]);
  });

  it('reads hidden branches with a second query only when asked, flagged and merged by date', async () => {
    const { service, lines } = branches({ 'find branch': visibleOrHidden(recordsOutput(FOUND_BRANCHES, TASK2, TASK1), recordsOutput(FOUND_BRANCHES, OLD_HIDDEN)) });

    const listed = await service.list(IN_WORKSPACE, { includeHidden: true });

    expect(lines()).toEqual([
      foundLine(FOUND_BRANCHES, "where hidden = 'false' order by date desc"),
      foundLine(FOUND_BRANCHES, "where hidden = 'true' order by date desc"),
    ]);
    expect(listed.map((branch) => [branch.name, branch.isHidden ?? false])).toEqual([
      ['/main/task2', false],
      ['/main/old', true],
      ['/main/task1', false],
    ]);
  });

  it('filters on the server by date, owners, text and limit, and never by branch', async () => {
    const { service, lines } = branches({ 'find branch': '' });

    await service.list(IN_WORKSPACE, { includeHidden: false, sinceDate: '2026-09-01', owners: ['ana'], text: 'task', limit: 50, branch: '/main' });

    expect(lines()).toEqual([
      foundLine(FOUND_BRANCHES, `where hidden = 'false' and name like '%ask%' and date >= '${roundTripDate('2026-09-01')}' and owner = 'ana' order by date desc limit 50`),
    ]);
  });

  it('remembers the names it listed, so code reviews name their branches without asking cm', async () => {
    const { service, branchNames, commands } = branches({ 'find branch': recordsOutput(FOUND_BRANCHES, TASK2, TASK1) });

    await service.list(IN_WORKSPACE, { includeHidden: false });

    expect(await branchNames.resolve(IN_WORKSPACE, [37, 38])).toEqual(
      new Map([
        [37, '/main/task1'],
        [38, '/main/task2'],
      ]),
    );
    expect(commands).toHaveLength(1);
  });
});

describe('one branch by name', () => {
  it('finds a branch by its last name part among visible and hidden ones, and picks the one with the full name', async () => {
    const { service, lines } = branches({
      'find branch': visibleOrHidden(recordsOutput(FOUND_BRANCHES, TASK1, OTHER_TASK1), ''),
    });

    const branch = await service.get(IN_WORKSPACE, '/main/fix/task1');

    expect(lines()).toEqual([
      foundLine(FOUND_BRANCHES, "where name = 'task1' and hidden = 'false' order by date desc"),
      foundLine(FOUND_BRANCHES, "where name = 'task1' and hidden = 'true' order by date desc"),
    ]);
    expect(branch).toMatchObject({ id: 40, name: '/main/fix/task1' });
  });

  it('finds a hidden branch, flagged as such', async () => {
    const { service } = branches({ 'find branch': visibleOrHidden('', recordsOutput(FOUND_BRANCHES, OLD_HIDDEN)) });

    expect(await service.get(IN_WORKSPACE, '/main/old')).toMatchObject({ id: 21, isHidden: true });
  });

  it("answers null for a branch that doesn't exist", async () => {
    const { service } = branches({ 'find branch': '' });

    expect(await service.get(IN_WORKSPACE, '/main/gone')).toBeNull();
  });

  it('looks a name holding a quote up with a wildcard in its place, and returns only the branch of that very name', async () => {
    const { service, lines } = branches({ 'find branch': branchesFound({ name: '/main/dani-s', id: 41 }) });

    expect(await service.get(IN_WORKSPACE, "/main/dani's")).toBeNull();
    expect(lines()[0]).toContain("name like 'dani%s'");
  });
});

describe('branch writes', () => {
  it('creates a branch at a changeset with its comment in a file deleted afterwards', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = branches({ 'branch create': answer });

    await service.create(IN_WORKSPACE, { name: '/main/task3', startingPoint: 'cs:12', comment: 'Line one\nLine two' });

    expect(commands).toMatchObject([
      { via: 'query', args: ['branch', 'create', '/main/task3', '--changeset=cs:12', `-commentsfile=${seen.file}`], options: { cwd: WORKSPACE } },
    ]);
    expect(seen.content).toBe('Line one\nLine two');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('deletes the comment file when the branch cannot be created', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=', cmFails('Error: The branch /main/task3 already exists.'));
    const { service } = branches({ 'branch create': answer });

    await expect(service.create(IN_WORKSPACE, { name: '/main/task3', comment: '' })).rejects.toThrow('already exists');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('replaces a comment with one quick command, the comment in a file deleted afterwards', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = branches({ 'branch editcomment': answer });

    await service.editComment(IN_WORKSPACE, '/main/task1', 'Fix the "jump" bug\nOn every level');

    expect(commands).toMatchObject([{ via: 'query', args: ['branch', 'editcomment', 'br:/main/task1', `-commentsfile=${seen.file}`], options: { cwd: WORKSPACE } }]);
    expect(seen.content).toBe('Fix the "jump" bug\nOn every level');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('removes a comment by replacing it with an empty one', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = branches({ 'branch editcomment': answer });

    await service.editComment(IN_WORKSPACE, '/main/task1', '');

    expect(commands).toMatchObject([{ args: ['branch', 'editcomment', 'br:/main/task1', `-commentsfile=${seen.file}`] }]);
    expect(seen.content).toBe('');
  });

  it('deletes the comment file when the comment cannot be replaced', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=', cmFails('Error: The branch /main/gone does not exist.'));
    const { service } = branches({ 'branch editcomment': answer });

    await expect(service.editComment(IN_WORKSPACE, '/main/gone', 'Gone')).rejects.toThrow('does not exist');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('renames, deletes, hides and unhides with one command for all the branches', async () => {
    const { service, lines } = branches({ branch: '' });

    await service.rename(IN_WORKSPACE, '/main/task1', 'task-one');
    await service.delete(IN_WORKSPACE, ['/main/task1', '/main/task2']);
    await service.setHidden(IN_WORKSPACE, ['/main/task1', '/main/task2'], true);
    await service.setHidden(IN_WORKSPACE, ['/main/task1'], false);

    expect(lines()).toEqual([
      'branch rename br:/main/task1 task-one',
      'branch delete br:/main/task1 br:/main/task2',
      'branch hide br:/main/task1 br:/main/task2',
      'branch unhide br:/main/task1',
    ]);
  });
});

describe('branches of a repository explored without a workspace', () => {
  const ON_REPOSITORY = repositoryPlace('game@local');
  const OUTSIDE = { outsideWorkspaces: true };

  it('lists them with the same finds, naming the repository last, run outside every workspace', async () => {
    const { service, commands, branchNames } = branches({ 'find branch': visibleOrHidden(recordsOutput(FOUND_BRANCHES, TASK1), recordsOutput(FOUND_BRANCHES, OLD_HIDDEN)) });

    const listed = await service.list(ON_REPOSITORY, { includeHidden: true, limit: 5 });

    expect(commands.map(({ args, options }) => [args[2], options])).toEqual([
      ["where hidden = 'false' order by date desc limit 5 on repository 'game@local'", OUTSIDE],
      ["where hidden = 'true' order by date desc limit 5 on repository 'game@local'", OUTSIDE],
    ]);
    expect(listed.map((branch) => branch.name)).toEqual(['/main/old', '/main/task1']);
    // The code review chips of that repository's window take their names from the list.
    expect(await branchNames.resolve(ON_REPOSITORY, [37])).toEqual(new Map([[37, '/main/task1']]));
  });

  it('creates, renames, comments, deletes, hides and unhides naming the repository on every spec', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = branches({ 'branch create': answer, 'branch editcomment': answer, branch: '' });

    await service.create(ON_REPOSITORY, { name: '/main/task3', startingPoint: 'lb:v1.0', comment: 'New' });
    await service.rename(ON_REPOSITORY, '/main/task1', 'task-one');
    await service.editComment(ON_REPOSITORY, '/main/task1', 'Fixed');
    await service.delete(ON_REPOSITORY, ['/main/task1', '/main/task2']);
    await service.setHidden(ON_REPOSITORY, ['/main/task1'], true);
    await service.setHidden(ON_REPOSITORY, ['/main/task1'], false);

    expect(commands.map(({ args, options }) => [args.map((arg) => (arg.startsWith('-commentsfile=') ? '-commentsfile=…' : arg)).join(' '), options])).toEqual([
      ['branch create br:/main/task3@game@local --label=lb:v1.0@game@local -commentsfile=…', OUTSIDE],
      ['branch rename br:/main/task1@game@local task-one', OUTSIDE],
      ['branch editcomment br:/main/task1@game@local -commentsfile=…', OUTSIDE],
      ['branch delete br:/main/task1@game@local br:/main/task2@game@local', OUTSIDE],
      ['branch hide br:/main/task1@game@local', OUTSIDE],
      ['branch unhide br:/main/task1@game@local', OUTSIDE],
    ]);
    expect(seen.content).toBe('Fixed');
  });
});

describe('recent branches', () => {
  const WORKSPACE_GUID = 'a0411612-d36e-4eca-b9b5-97acad5969ea';
  const branchGuid = (n: number): string => `9b8e2f7a-58f3-4c43-9d83-3c2f1f5c000${n}`;

  function recentBranches() {
    const fake = fakeCmClient({ getworkspacefrompath: formatOutput(['game', WORKSPACE_GUID]) });
    const settings = new SettingsStore(join(mkdtempSync(join(tmpdir(), 'uvcs-settings-')), 'settings.json'));
    const headers = new WorkspaceHeaders(cmHeaderReaders(fake.cm));
    const service = createBranchesService(serviceContext(fake.cm, { settings, headers }), { branchNames: new BranchNamesCache(async () => []) });
    return { ...fake, settings, headers, service };
  }

  it("keeps each switch in the app's settings, by workspace GUID, newest first", async () => {
    const { service, settings, commands } = recentBranches();
    expect(await service.recent(WORKSPACE)).toEqual([]);

    await service.rememberRecent(WORKSPACE, branchGuid(1));
    await service.rememberRecent(WORKSPACE, branchGuid(2).toUpperCase());

    expect(await service.recent(WORKSPACE)).toEqual([branchGuid(2), branchGuid(1)]);
    expect(settings.get().recentBranchesByWorkspace).toEqual({ [WORKSPACE_GUID]: [branchGuid(2), branchGuid(1)] });
    // The workspace's GUID is a local read: no server round trip.
    expect(new Set(commands.map((command) => command.line.split(' ')[0]))).toEqual(new Set(['getworkspacefrompath']));
  });

  it("takes the workspace's GUID from its names already read for the workspace info, asking cm nothing more", async () => {
    const { service, headers, commands } = recentBranches();
    await headers.names(WORKSPACE);

    await service.recent(WORKSPACE);
    await service.rememberRecent(WORKSPACE, branchGuid(1));

    expect(commands).toHaveLength(1);
  });

  it('keeps five, never /main', async () => {
    const { service } = recentBranches();
    for (const n of [1, 2, 3, 4, 5, 6]) await service.rememberRecent(WORKSPACE, branchGuid(n));
    await service.rememberRecent(WORKSPACE, MAIN_BRANCH_GUID);

    expect(await service.recent(WORKSPACE)).toEqual([6, 5, 4, 3, 2].map(branchGuid));
  });
});
