import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAIN_BRANCH_GUID } from '@shared/domain/branch';
import { BranchNamesCache } from '../cm/BranchNamesCache';
import { findXml } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, type CmAnswer } from '../cm/testing/fakeCmClient';
import { SettingsStore } from '../settings/SettingsStore';
import { createBranchesService, startingPointOption } from './branchesService';
import { readingFileOption } from './testing/readingFileOption';
import { serviceContext } from './testing/serviceContext';

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

function branchRecord(id: number, name: string, date: string) {
  return {
    ID: id,
    COMMENT: '',
    DATE: date,
    OWNER: 'ana',
    NAME: name,
    PARENT: '/main',
    REPNAME: 'game',
    REPSERVER: 'local',
    CHANGESET: 12,
    GUID: `guid-${id}`,
  };
}

const TASK1 = branchRecord(37, '/main/task1', '2026-09-25T10:00:00+02:00');
const TASK2 = branchRecord(38, '/main/task2', '2026-09-27T10:00:00+02:00');
const OLD_HIDDEN = branchRecord(21, '/main/old', '2026-09-26T10:00:00+02:00');
const OTHER_TASK1 = { ...branchRecord(40, '/main/fix/task1', '2026-09-28T10:00:00+02:00'), PARENT: '/main/fix' };

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
    const { service, commands } = branches({ 'find branch': findXml('BRANCH', TASK2, TASK1) });

    const listed = await service.list(WORKSPACE, { includeHidden: false });

    expect(commands).toMatchObject([
      { via: 'query', args: ['find', 'branch', "where hidden = 'false' order by date desc", '--xml', '--nototal'], options: { cwd: WORKSPACE } },
    ]);
    expect(listed.map((branch) => [branch.id, branch.name, branch.repository])).toEqual([
      [38, '/main/task2', 'game@local'],
      [37, '/main/task1', 'game@local'],
    ]);
  });

  it('reads hidden branches with a second query only when asked, flagged and merged by date', async () => {
    const { service, lines } = branches({ 'find branch': visibleOrHidden(findXml('BRANCH', TASK2, TASK1), findXml('BRANCH', OLD_HIDDEN)) });

    const listed = await service.list(WORKSPACE, { includeHidden: true });

    expect(lines()).toEqual([
      "find branch where hidden = 'false' order by date desc --xml --nototal",
      "find branch where hidden = 'true' order by date desc --xml --nototal",
    ]);
    expect(listed.map((branch) => [branch.name, branch.isHidden ?? false])).toEqual([
      ['/main/task2', false],
      ['/main/old', true],
      ['/main/task1', false],
    ]);
  });

  it('filters on the server by date, owners, text and limit, and never by branch', async () => {
    const { service, lines } = branches({ 'find branch': findXml('BRANCH') });

    await service.list(WORKSPACE, { includeHidden: false, sinceDate: '2026-09-01', owners: ['ana'], text: 'task', limit: 50, branch: '/main' });

    expect(lines()).toEqual([
      "find branch where hidden = 'false' and name like '%ask%' and date >= '2026-09-01' and owner = 'ana' order by date desc limit 50 --xml --nototal",
    ]);
  });

  it('remembers the names it listed, so code reviews name their branches without asking cm', async () => {
    const { service, branchNames, commands } = branches({ 'find branch': findXml('BRANCH', TASK2, TASK1) });

    await service.list(WORKSPACE, { includeHidden: false });

    expect(await branchNames.resolve(WORKSPACE, [37, 38])).toEqual(
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
      'find branch': visibleOrHidden(findXml('BRANCH', TASK1, OTHER_TASK1), findXml('BRANCH')),
    });

    const branch = await service.get(WORKSPACE, '/main/fix/task1');

    expect(lines()).toEqual([
      "find branch where name = 'task1' and hidden = 'false' --xml --nototal",
      "find branch where name = 'task1' and hidden = 'true' --xml --nototal",
    ]);
    expect(branch).toMatchObject({ id: 40, name: '/main/fix/task1' });
  });

  it('finds a hidden branch, flagged as such', async () => {
    const { service } = branches({ 'find branch': visibleOrHidden(findXml('BRANCH'), findXml('BRANCH', OLD_HIDDEN)) });

    expect(await service.get(WORKSPACE, '/main/old')).toMatchObject({ id: 21, isHidden: true });
  });

  it("answers null for a branch that doesn't exist", async () => {
    const { service } = branches({ 'find branch': findXml('BRANCH') });

    expect(await service.get(WORKSPACE, '/main/gone')).toBeNull();
  });

  it("escapes quotes in the name so the query can't break", async () => {
    const { service, lines } = branches({ 'find branch': findXml('BRANCH') });

    await service.get(WORKSPACE, "/main/dani's");

    expect(lines()[0]).toContain("name = 'dani''s'");
  });
});

describe('branch writes', () => {
  it('creates a branch at a changeset with its comment in a file deleted afterwards', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=');
    const { service, commands } = branches({ 'branch create': answer });

    await service.create(WORKSPACE, { name: '/main/task3', startingPoint: 'cs:12', comment: 'Line one\nLine two' });

    expect(commands).toMatchObject([
      { via: 'query', args: ['branch', 'create', '/main/task3', '--changeset=cs:12', `-commentsfile=${seen.file}`], options: { cwd: WORKSPACE } },
    ]);
    expect(seen.content).toBe('Line one\nLine two');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('deletes the comment file when the branch cannot be created', async () => {
    const { seen, answer } = readingFileOption('-commentsfile=', cmFails('Error: The branch /main/task3 already exists.'));
    const { service } = branches({ 'branch create': answer });

    await expect(service.create(WORKSPACE, { name: '/main/task3', comment: '' })).rejects.toThrow('already exists');
    expect(existsSync(seen.file)).toBe(false);
  });

  it('renames, deletes, hides and unhides with one command for all the branches', async () => {
    const { service, lines } = branches({ branch: '' });

    await service.rename(WORKSPACE, '/main/task1', 'task-one');
    await service.delete(WORKSPACE, ['/main/task1', '/main/task2']);
    await service.setHidden(WORKSPACE, ['/main/task1', '/main/task2'], true);
    await service.setHidden(WORKSPACE, ['/main/task1'], false);

    expect(lines()).toEqual([
      'branch rename br:/main/task1 task-one',
      'branch delete br:/main/task1 br:/main/task2',
      'branch hide br:/main/task1 br:/main/task2',
      'branch unhide br:/main/task1',
    ]);
  });
});

describe('recent branches', () => {
  const WORKSPACE_GUID = 'a0411612-d36e-4eca-b9b5-97acad5969ea';
  const branchGuid = (n: number): string => `9b8e2f7a-58f3-4c43-9d83-3c2f1f5c000${n}`;

  function recentBranches() {
    const fake = fakeCmClient({ [`getworkspacefrompath ${WORKSPACE} --format={guid}`]: `${WORKSPACE_GUID}\n` });
    const settings = new SettingsStore(join(mkdtempSync(join(tmpdir(), 'uvcs-settings-')), 'settings.json'));
    const service = createBranchesService(serviceContext(fake.cm, { settings }), { branchNames: new BranchNamesCache(async () => []) });
    return { ...fake, settings, service };
  }

  it("keeps each switch in the app's settings, by workspace GUID, newest first", async () => {
    const { service, settings, commands } = recentBranches();
    expect(await service.recent(WORKSPACE)).toEqual([]);

    await service.rememberRecent(WORKSPACE, branchGuid(1));
    await service.rememberRecent(WORKSPACE, branchGuid(2).toUpperCase());

    expect(await service.recent(WORKSPACE)).toEqual([branchGuid(2), branchGuid(1)]);
    expect(settings.get().recentBranchesByWorkspace).toEqual({ [WORKSPACE_GUID]: [branchGuid(2), branchGuid(1)] });
    // The workspace's GUID is a local read: no server round trip.
    expect(new Set(commands.map((command) => command.line))).toEqual(new Set([`getworkspacefrompath ${WORKSPACE} --format={guid}`]));
  });

  it('keeps five, never /main', async () => {
    const { service } = recentBranches();
    for (const n of [1, 2, 3, 4, 5, 6]) await service.rememberRecent(WORKSPACE, branchGuid(n));
    await service.rememberRecent(WORKSPACE, MAIN_BRANCH_GUID);

    expect(await service.recent(WORKSPACE)).toEqual([6, 5, 4, 3, 2].map(branchGuid));
  });
});

describe('startingPointOption', () => {
  it('starts a branch at a changeset, a label, or the head of its parent', () => {
    expect(startingPointOption('cs:12')).toEqual(['--changeset=cs:12']);
    expect(startingPointOption('lb:v1.0')).toEqual(['--label=lb:v1.0']);
    expect(startingPointOption(undefined)).toEqual([]);
  });

  it('refuses any other starting point', () => {
    expect(() => startingPointOption('sh:3')).toThrow('A branch can only start at a changeset or a label');
  });
});
