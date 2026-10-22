import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';
import { statusRecordsArgs } from '../cm/pendingChangesRecords';
import { change, formatOutput, machineReadableStatusHeader, pendingStatus, statusHeader, UNITY_ORGANIZATION } from '../cm/testing/cmOutput';
import { cmFails, fakeCmClient, runsUntilCancelled, type CmAnswer } from '../cm/testing/fakeCmClient';
import { UPDATE_ARGS } from '../cm/updateArgs';
import { runForCaller } from '../ipc/caller';
import type { WorkspaceWatchers } from '../watch/WorkspaceWatchers';
import type { WorkspaceWindows } from '../window/WorkspaceWindows';
import { cmHeaderReaders, WorkspaceHeaders } from '../workspace/WorkspaceHeaders';
import type { SwitchContext } from './ServiceContext';
import { serviceContext } from './testing/serviceContext';
import { createWorkspacesService } from './workspacesService';

vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }));

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

const STATUS_HEADER = statusHeader('/main/task1', { changeset: 12, repository: 'game' });

function workspaces(answers: Record<string, CmAnswer>, watchers?: Partial<WorkspaceWatchers>, windows?: Partial<WorkspaceWindows>) {
  const fake = fakeCmClient(answers);
  const headers = new WorkspaceHeaders(cmHeaderReaders(fake.cm));
  const context = serviceContext(fake.cm, { headers, watchers: watchers as WorkspaceWatchers, windows: { workspaceShown: () => undefined, ...windows } as WorkspaceWindows });
  return { ...fake, operations: context.operations, service: createWorkspacesService(context, {} as SwitchContext) };
}

const WORKSPACE_NAMES = { getworkspacefrompath: formatOutput(['game', 'a0411612']) };

describe('workspace list', () => {
  it('lists the workspaces with one local read in any directory, each folder once', async () => {
    const { service, commands } = workspaces({
      'workspace list': formatOutput(['game', WORKSPACE, 'g1'], ['game-copy', WORKSPACE, 'g2'], ['tools', join(tmpdir(), 'tools'), 'g3']),
    });

    expect(await service.list()).toEqual([
      { name: 'game-copy', path: WORKSPACE, guid: 'g2' },
      { name: 'tools', path: join(tmpdir(), 'tools'), guid: 'g3' },
    ]);
    expect(commands).toMatchObject([{ via: 'query', args: ['workspace', 'list', '--format={wkname}\u001f{path}\u001f{wkid}\u001e'], options: { anyDirectory: true } }]);
  });
});

describe('workspace info', () => {
  it('tells what the workspace is loaded from and its name with two local reads', async () => {
    const { service, lines } = workspaces({ status: STATUS_HEADER, ...WORKSPACE_NAMES });

    expect(await service.info(WORKSPACE)).toEqual({
      name: 'game',
      path: WORKSPACE,
      repository: 'game@local',
      repositoryName: 'game',
      server: 'local',
      selector: { kind: 'branch', name: '/main/task1' },
      loadedChangeset: 12,
    });
    expect(lines().map((line) => line.split(' ')[0])).toEqual(['status', 'getworkspacefrompath']);
  });

  it("names a Unity organization's server as cm does everywhere else, though the header prints its id", async () => {
    const { service, commands } = workspaces({
      'status --header --xml': statusHeader('/main/task1', { changeset: 12, repository: 'game', server: UNITY_ORGANIZATION.byId }),
      'status --header --machinereadable': machineReadableStatusHeader('game', UNITY_ORGANIZATION.byName, 12),
      ...WORKSPACE_NAMES,
    });

    expect(await service.info(WORKSPACE)).toEqual({
      name: 'game',
      path: WORKSPACE,
      repository: 'game@AcmeStudio@unity',
      repositoryName: 'game',
      server: 'AcmeStudio@unity',
      selector: { kind: 'branch', name: '/main/task1' },
      loadedChangeset: 12,
    });
    // Only an id asks the machine-readable header, a local read in the workspace's own sessions.
    expect(commands.filter(({ args }) => args.includes('--machinereadable'))).toMatchObject([
      { via: 'query', args: ['status', '--header', '--machinereadable', '--fieldseparator=|', WORKSPACE], options: { cwd: WORKSPACE } },
    ]);
  });

  it("still opens a Unity organization's workspace when cm can't name its server, keeping the id rather than a guess", async () => {
    for (const machineReadable of [cmFails('The workspace is locked.'), machineReadableStatusHeader('game', UNITY_ORGANIZATION.byId, 12)]) {
      const { service } = workspaces({
        'status --header --xml': statusHeader('/main/task1', { changeset: 12, repository: 'game', server: UNITY_ORGANIZATION.byId }),
        'status --header --machinereadable': machineReadable,
        ...WORKSPACE_NAMES,
      });

      expect(await service.info(WORKSPACE)).toMatchObject({
        repository: `game@${UNITY_ORGANIZATION.byId}`,
        server: UNITY_ORGANIZATION.byId,
        selector: { kind: 'branch', name: '/main/task1' },
        loadedChangeset: 12,
      });
    }
  });

  it('renames the workspace by its current name, read alone, and reads its name again afterwards', async () => {
    const { service, lines } = workspaces({ status: STATUS_HEADER, ...WORKSPACE_NAMES, 'workspace rename': '' });

    await service.rename(WORKSPACE, 'game-2');
    await service.info(WORKSPACE);

    expect(lines().map((line) => line.split(' ').slice(0, 2).join(' '))).toEqual([
      `getworkspacefrompath ${WORKSPACE}`,
      'workspace rename',
      'status --header',
      `getworkspacefrompath ${WORKSPACE}`,
    ]);
    expect(lines()[1]).toBe('workspace rename game game-2');
  });
});

describe('creating a workspace', () => {
  async function emptyFolder(): Promise<string> {
    return join(await mkdtemp(join(tmpdir(), 'new-wk-')), 'game');
  }

  it('creates the workspace and returns it as listed', async () => {
    const path = await emptyFolder();
    const { service, lines } = workspaces({ 'workspace create': '', 'workspace list': formatOutput(['game', path, 'g1']) });

    expect(await service.create({ name: 'game', path, repository: 'game@local' })).toEqual({ name: 'game', path, guid: 'g1' });
    expect(lines()[0]).toBe(`workspace create game ${path} game@local`);
  });

  it("fails when the new workspace isn't listed", async () => {
    const path = await emptyFolder();
    const { service } = workspaces({ 'workspace create': '', 'workspace list': '' });

    await expect(service.create({ name: 'game', path, repository: 'game@local' })).rejects.toThrow('Workspace game was not found after creating it.');
  });

  it('discarding a new workspace deletes the folder it was created in', async () => {
    const path = await emptyFolder();
    const { service, lines } = workspaces({
      'workspace create': async () => {
        await mkdir(path);
        return '';
      },
      'workspace list': formatOutput(['game', path, 'g1']),
      'workspace delete': '',
    });

    await service.create({ name: 'game', path, repository: 'game@local' });
    await service.discardNew(path);

    expect(lines().at(-1)).toBe(`workspace delete ${path}`);
    expect(existsSync(path)).toBe(false);
  });

  it("discarding a workspace keeps a folder it didn't create: one that held files already", async () => {
    const path = await emptyFolder();
    await mkdir(path);
    await writeFile(join(path, 'notes.txt'), 'mine');
    const { service } = workspaces({ 'workspace create': '', 'workspace list': formatOutput(['game', path, 'g1']), 'workspace delete': '' });

    await service.create({ name: 'game', path, repository: 'game@local' });
    await service.discardNew(path);

    expect(existsSync(join(path, 'notes.txt'))).toBe(true);
  });
});

describe('update', () => {
  it('updates with one cm update of its own process that never opens a merge tool', async () => {
    const { service, commands } = workspaces({ update: '' });

    await service.update(WORKSPACE, 'op-1');

    expect(commands).toMatchObject([{ via: 'execute', args: UPDATE_ARGS, options: { cwd: WORKSPACE } }]);
    expect(commands[0]?.args).toContain('--dontmerge');
  });

  it('explains an update stopped by local changes that collide with incoming ones', async () => {
    const { service } = workspaces({
      update: cmFails(
        '<STAGE:Calculating conflicts>\nThe update operation detected conflicts. The operation cannot continue since it was run with the --dontmerge option.\n<STAGE:Finished>\n',
      ),
    });

    const error = await service.update(WORKSPACE, 'op-1').catch((caught: unknown) => caught);

    expect(error).toMatchObject({
      message: 'Some of your local changes collide with incoming ones. Open Incoming to merge them while updating.',
      command: { commandLine: 'cm update --forcedetailedprogress --noinput --dontmerge' },
    });
  });

  it('keeps any other failure as cm reported it', async () => {
    const { service } = workspaces({ update: cmFails('Error: The server is unreachable.') });

    await expect(service.update(WORKSPACE, 'op-1')).rejects.toThrow('The server is unreachable.');
  });

  it('can be cancelled', async () => {
    const { service, operations } = workspaces({ update: runsUntilCancelled('Error: Operation cancelled.') });

    const updating = service.update(WORKSPACE, 'op-9');
    operations.cancel('op-9');

    await expect(updating).rejects.toThrow('Operation cancelled.');
  });
});

describe('a new workspace for a task', () => {
  it('switches the empty workspace with one plain cm switch of its own process', async () => {
    const { service, commands } = workspaces({ switch: '' });

    await service.switchNewWorkspace(WORKSPACE, 'br:/main/task2', 'op-1');

    expect(commands).toMatchObject([{ via: 'execute', args: ['switch', 'br:/main/task2', '--forcedetailedprogress', '--noinput'], options: { cwd: WORKSPACE } }]);
  });
});

describe('watching a workspace', () => {
  it("shows the workspace's cm sessions and watches it for the calling window", async () => {
    const watch = vi.fn(() => ({ complete: true }) as never);
    const { service, shown } = workspaces({}, { watch, coverageOf: () => undefined }, { showsHomeScreen: () => true });
    const window = { id: 7, isDestroyed: () => false } as unknown as WebContents;

    await runForCaller(window, () => service.watch(WORKSPACE));

    expect(shown).toEqual([WORKSPACE]);
    expect(watch).toHaveBeenCalledWith(7, WORKSPACE);
  });

  it('tells the windows which workspace the calling window shows now, or none, so the page windows it left behind close', async () => {
    const workspaceShown = vi.fn();
    const window = { id: 7, isDestroyed: () => false } as unknown as WebContents;
    const { service } = workspaces({}, { watch: async () => 'full' as const, coverageOf: () => undefined, release: () => undefined }, { showsHomeScreen: () => true, workspaceShown });

    await runForCaller(window, () => service.watch(WORKSPACE));
    await runForCaller(window, () => service.unwatch());

    expect(workspaceShown.mock.calls).toEqual([
      [7, WORKSPACE],
      [7, undefined],
    ]);
  });

  it("lets the home folder's cm sessions go once no window shows the home screen, and keeps them while one does", async () => {
    const window = { id: 7, isDestroyed: () => false } as unknown as WebContents;
    let homeScreen = true;
    const { service, released } = workspaces({}, { watch: async () => 'full' as const, coverageOf: () => undefined }, { showsHomeScreen: () => homeScreen });

    await runForCaller(window, () => service.watch(WORKSPACE));
    expect(released).toEqual([]);

    homeScreen = false;
    await runForCaller(window, () => service.watch(WORKSPACE));
    expect(released).toEqual([homedir()]);
  });

  it.each([
    ['opens it first: never let go', [homedir(), WORKSPACE], []],
    ['opens it after another window opened another workspace: let go before it opened only', [WORKSPACE, homedir()], [homedir()]],
  ])('keeps the cm sessions of a workspace in the home folder itself while a window shows it, whichever %s', async (_order, opened, releasedHome) => {
    const window = { id: 7, isDestroyed: () => false } as unknown as WebContents;
    const watched = new Set<string>();
    const watchers = {
      watch: async (_viewer: number, workspacePath: string) => (watched.add(workspacePath), 'full' as const),
      coverageOf: (workspacePath: string) => (watched.has(workspacePath) ? ('full' as const) : undefined),
    };
    const { service, released, shown } = workspaces({}, watchers, { showsHomeScreen: () => false });

    for (const workspacePath of opened) await runForCaller(window, () => service.watch(workspacePath));

    expect(shown).toEqual(opened);
    expect(released).toEqual(releasedHome);
  });
});

describe('other workspaces', () => {
  it('finds the root of the workspace holding a folder, or none outside any workspace, with a local read in any directory', async () => {
    const { service, commands } = workspaces({
      getworkspacefrompath: ({ args }) => (args[1] === join(WORKSPACE, 'src') ? `${WORKSPACE}\n` : cmFails(`Error: ${args[1]} is not in a workspace.`)),
    });

    expect(await service.findRoot(join(WORKSPACE, 'src'))).toBe(WORKSPACE);
    expect(await service.findRoot(tmpdir())).toBeNull();
    expect(commands.map(({ via, options }) => ({ via, options }))).toEqual([
      { via: 'query', options: { anyDirectory: true } },
      { via: 'query', options: { anyDirectory: true } },
    ]);
  });

  it("glances at another workspace's branch and pending changes with two local cm status, in any directory", async () => {
    const { service, commands } = workspaces({ 'status --header --xml': STATUS_HEADER, status: pendingStatus(WORKSPACE, change('CH', 'a.cs')) });

    expect(await service.glance(WORKSPACE)).toEqual({ selector: { kind: 'branch', name: '/main/task1' }, pendingCount: 1 });
    expect(commands.map(({ via, args, options }) => ({ via, args, options }))).toEqual([
      { via: 'query', args: ['status', '--header', '--xml', WORKSPACE], options: { anyDirectory: true } },
      { via: 'query', args: statusRecordsArgs(WORKSPACE), options: { anyDirectory: true } },
    ]);
  });

  it("glances at a Unity organization's workspace with those two commands, as the switcher shows no repository from it", async () => {
    const { service, commands } = workspaces({
      'status --header --xml': statusHeader('/main/task1', { repository: 'game', server: UNITY_ORGANIZATION.byId }),
      status: pendingStatus(WORKSPACE),
    });

    expect(await service.glance(WORKSPACE)).toEqual({ selector: { kind: 'branch', name: '/main/task1' }, pendingCount: 0 });
    expect(commands).toHaveLength(2);
  });

  it('tells what every listed workspace works on with one local cm wi each, in a pooled shell in any directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'uvcs-heads-'));
    const [game, cloud] = [join(root, 'game'), join(root, 'cloud game')];
    await Promise.all([mkdir(game), mkdir(cloud)]);
    const { service, commands } = workspaces({
      wi: ({ args }) => (args[1] === game ? 'BR\u001f/main/task1\u001fgame@local\n' : `CS\u001f153\u001f3dtest/game@${UNITY_ORGANIZATION.byName}\n`),
    });

    expect(await service.heads([game, cloud, join(root, 'gone')])).toEqual({
      [game]: { repository: 'game@local', repositoryName: 'game', selector: { kind: 'branch', name: '/main/task1' } },
      [cloud]: { repository: `3dtest/game@${UNITY_ORGANIZATION.byName}`, repositoryName: '3dtest/game', selector: { kind: 'changeset', name: '153' } },
    });
    expect(commands.map(({ via, args, options }) => ({ via, path: args[1], options }))).toEqual([
      { via: 'query', path: game, options: { anyDirectory: true } },
      { via: 'query', path: cloud, options: { anyDirectory: true } },
    ]);
  });
});
