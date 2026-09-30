import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { WebContents } from 'electron';
import { cmFails, fakeCmClient, formatOutput, runsUntilCancelled, type CmAnswer } from '../cm/testing/fakeCmClient';
import { UPDATE_ARGS } from '../cm/updateArgs';
import { runForCaller } from '../ipc/caller';
import type { WorkspaceWatchers } from '../watch/WorkspaceWatchers';
import { cmHeaderReaders, WorkspaceHeaders } from '../workspace/WorkspaceHeaders';
import type { SwitchContext } from './ServiceContext';
import { serviceContext } from './testing/serviceContext';
import { createWorkspacesService } from './workspacesService';

vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }));

const WORKSPACE = join(tmpdir(), 'wkspaces', 'game');

const STATUS_HEADER = `<?xml version="1.0" encoding="utf-8"?>
<StatusOutput>
  <WorkspaceStatus><Status><RepSpec><Server>local</Server><Name>game</Name></RepSpec><Changeset>12</Changeset></Status></WorkspaceStatus>
  <WkConfigType>Branch</WkConfigType>
  <WkConfigName>/main/task1@game@local</WkConfigName>
</StatusOutput>`;

function workspaces(answers: Record<string, CmAnswer>, watchers?: Partial<WorkspaceWatchers>) {
  const fake = fakeCmClient(answers);
  const headers = new WorkspaceHeaders(cmHeaderReaders(fake.cm));
  const context = serviceContext(fake.cm, { headers, watchers: watchers as WorkspaceWatchers });
  return { ...fake, operations: context.operations, service: createWorkspacesService(context, {} as SwitchContext) };
}

const WORKSPACE_NAMES = { getworkspacefrompath: formatOutput(['game', 'a0411612']) };

describe('workspace list', () => {
  it('lists the workspaces with one local read, each folder once', async () => {
    const { service, commands } = workspaces({
      'workspace list': formatOutput(['game', WORKSPACE, 'g1'], ['game-copy', WORKSPACE, 'g2'], ['tools', join(tmpdir(), 'tools'), 'g3']),
    });

    expect(await service.list()).toEqual([
      { name: 'game-copy', path: WORKSPACE, guid: 'g2' },
      { name: 'tools', path: join(tmpdir(), 'tools'), guid: 'g3' },
    ]);
    expect(commands).toMatchObject([{ via: 'query', args: ['workspace', 'list', '--format={wkname}\u001f{path}\u001f{wkid}\u001e'] }]);
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

  it('renames the workspace by its current name, and reads its name again afterwards', async () => {
    const { service, lines } = workspaces({ status: STATUS_HEADER, ...WORKSPACE_NAMES, 'workspace rename': '' });

    await service.rename(WORKSPACE, 'game-2');
    await service.info(WORKSPACE);

    expect(lines().map((line) => line.split(' ').slice(0, 2).join(' '))).toEqual([
      'status --header',
      `getworkspacefrompath ${WORKSPACE}`,
      'workspace rename',
      'status --header',
      `getworkspacefrompath ${WORKSPACE}`,
    ]);
    expect(lines()[2]).toBe('workspace rename game game-2');
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
  it("warms up the workspace's cm sessions and watches it for the calling window", async () => {
    const watch = vi.fn(() => ({ complete: true }) as never);
    const { service, warmedUp } = workspaces({}, { watch });
    const window = { id: 7, isDestroyed: () => false } as unknown as WebContents;

    await runForCaller(window, () => service.watch(WORKSPACE));

    expect(warmedUp).toEqual([WORKSPACE]);
    expect(watch).toHaveBeenCalledWith(7, WORKSPACE);
  });
});

describe('other workspaces', () => {
  it('finds the root of the workspace holding a folder, or none outside any workspace', async () => {
    const { service } = workspaces({
      getworkspacefrompath: ({ args }) => (args[1] === join(WORKSPACE, 'src') ? `${WORKSPACE}\n` : cmFails(`Error: ${args[1]} is not in a workspace.`)),
    });

    expect(await service.findRoot(join(WORKSPACE, 'src'))).toBe(WORKSPACE);
    expect(await service.findRoot(tmpdir())).toBeNull();
  });

  it("glances at another workspace's branch and pending changes with one local cm status from the home folder", async () => {
    const withChanges = STATUS_HEADER.replace(
      '</StatusOutput>',
      '<Changes><Change><Type>CH</Type><Path>a.cs</Path><OldPath /><MergesInfo /><SimilarityPerUnit>0</SimilarityPerUnit><Size>3</Size><RevisionType>enTextFile</RevisionType><LastModified>2026-09-25T08:26:09+02:00</LastModified></Change></Changes></StatusOutput>',
    );
    const { service, commands } = workspaces({ status: withChanges });

    expect(await service.glance(WORKSPACE)).toEqual({ repository: 'game@local', selector: { kind: 'branch', name: '/main/task1' }, pendingCount: 1 });
    expect(commands).toMatchObject([{ via: 'query', args: ['status', '--xml', WORKSPACE], options: {} }]);
    expect(commands[0]?.options.cwd).toBeUndefined();
  });
});
