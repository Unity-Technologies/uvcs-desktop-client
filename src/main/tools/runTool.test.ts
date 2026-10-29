import { join, normalize } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { repositoryPlace, workspacePlace } from '@shared/domain/place';
import { DEFAULT_SETTINGS } from '@shared/domain/settings';
import type { Tool } from '@shared/domain/tools';
import type { LaunchCommand } from '../system/apps/launchCommand';
import { fakeFileSystem } from '../system/apps/testing/appFixtures';
import { runTool, type ToolRunDependencies } from './runTool';

const WORKSPACE = join('work', 'game');
const POST: Tool = { id: 'tool:1', name: 'Post', program: '/opt/post', args: ['--object={object}', '{repository}', '{workspace}'], targets: ['changeset', 'item'] };

function setUp(tools: Tool[] = [POST], parts: Partial<ToolRunDependencies> = {}) {
  const launched: LaunchCommand[] = [];
  const dependencies: ToolRunDependencies = {
    settings: { get: () => ({ ...DEFAULT_SETTINGS, tools }) },
    saveRevision: vi.fn(async (_place, _version, fileName: string) => join('tmp', 'uvcs-rev-1', fileName)),
    launch: vi.fn(async (command: LaunchCommand) => void launched.push(command)),
    platform: 'linux',
    env: {},
    fs: fakeFileSystem([]),
    ...parts,
  };
  return { dependencies, launched };
}

describe('runTool', () => {
  it('starts the program once per object, in the workspace, each argument filled in', async () => {
    const { dependencies, launched } = setUp();
    await runTool(dependencies, workspacePlace(WORKSPACE), 'tool:1', [
      { kind: 'changeset', id: 12, repository: 'game@local' },
      { kind: 'changeset', id: 13, repository: 'game@local' },
    ]);
    expect(launched).toEqual([
      { command: '/opt/post', args: ['--object=cs:12', 'game@local', WORKSPACE], cwd: WORKSPACE, exits: false },
      { command: '/opt/post', args: ['--object=cs:13', 'game@local', WORKSPACE], cwd: WORKSPACE, exits: false },
    ]);
  });

  it("names the window's repository when there's no workspace, and starts where the app does", async () => {
    const { dependencies, launched } = setUp();
    await runTool(dependencies, repositoryPlace('game@remote:8087'), 'tool:1', [{ kind: 'changeset', id: 7 }]);
    expect(launched).toEqual([{ command: '/opt/post', args: ['--object=cs:7', 'game@remote:8087', ''], exits: false }]);
  });

  it('saves a revision to a temp file first and passes that path', async () => {
    const { dependencies, launched } = setUp();
    const version = { kind: 'revision', revision: { revisionId: 45, repository: 'game@local' }, fileName: 'a.cs' } as const;
    await runTool(dependencies, workspacePlace(WORKSPACE), 'tool:1', [{ kind: 'revision', version, fileName: 'a.cs', repository: 'game@local' }]);
    expect(dependencies.saveRevision).toHaveBeenCalledWith(workspacePlace(WORKSPACE), version, 'a.cs');
    expect(launched[0]?.args).toEqual([`--object=${join('tmp', 'uvcs-rev-1', 'a.cs')}`, 'game@local', WORKSPACE]);
  });

  it("passes a file's path in the OS's own separators", async () => {
    const { dependencies, launched } = setUp();
    await runTool(dependencies, workspacePlace(WORKSPACE), 'tool:1', [{ kind: 'item', path: `${WORKSPACE}/src/a.cs` }]);
    expect(launched[0]?.args[0]).toBe(`--object=${normalize(`${WORKSPACE}/src/a.cs`)}`);
  });

  it("stops at the first object it can't start the program for", async () => {
    const launch = vi.fn(async () => {
      throw new Error("Couldn't start /opt/post: it is not there anymore");
    });
    const { dependencies } = setUp([POST], { launch });
    const running = runTool(dependencies, workspacePlace(WORKSPACE), 'tool:1', [
      { kind: 'changeset', id: 1 },
      { kind: 'changeset', id: 2 },
    ]);
    await expect(running).rejects.toThrow('it is not there anymore');
    expect(launch).toHaveBeenCalledTimes(1);
  });

  it('reads %VAR% in the program, and runs the program of a macOS app bundle so it gets the arguments', async () => {
    const bundle = '/Applications/Poster.app';
    const { dependencies, launched } = setUp([{ ...POST, program: '%APPS%/Poster.app', args: ['{object}'] }], {
      platform: 'darwin',
      env: { APPS: '/Applications' },
      fs: fakeFileSystem([`${bundle}/Contents/MacOS/Poster`]),
    });
    await runTool(dependencies, workspacePlace('/work/game'), 'tool:1', [{ kind: 'branch', name: '/main' }]);
    expect(launched).toEqual([{ command: `${bundle}/Contents/MacOS/Poster`, args: ['br:/main'], cwd: '/work/game', exits: false }]);
  });

  it('runs a Windows .cmd script through cmd.exe, its arguments quoted', async () => {
    const { dependencies, launched } = setUp([{ ...POST, program: 'C:\\Tools\\post.cmd', args: ['{object}'] }], { platform: 'win32' });
    await runTool(dependencies, repositoryPlace('game@local'), 'tool:1', [{ kind: 'label', name: 'v1 final' }]);
    expect(launched[0]).toMatchObject({ command: 'cmd.exe', verbatim: true, args: ['/d', '/s', '/c', '""C:\\Tools\\post.cmd" "lb:v1 final""'] });
  });

  it('fails when the tool is gone', async () => {
    const { dependencies, launched } = setUp([]);
    await expect(runTool(dependencies, workspacePlace(WORKSPACE), 'tool:1', [{ kind: 'branch', name: '/main' }])).rejects.toThrow("That tool isn't there anymore.");
    expect(launched).toEqual([]);
  });
});
