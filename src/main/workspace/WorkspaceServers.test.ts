import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WorkspaceStatus } from '../cm/workspaceStatus';
import type { HeaderReaders } from './WorkspaceHeaders';
import { WorkspaceServers, type ReadWorkspaceServer } from './WorkspaceServers';

const GAME = join('/wkspaces', 'game');

function readers(server: string): HeaderReaders {
  const status = { server } as WorkspaceStatus;
  return { status: async () => status, names: async () => ({ name: 'game', guid: 'g' }) };
}

/** Workspace servers whose local reads answer `server` as `GAME`'s, counted. */
function servers(server: string | undefined, platform: NodeJS.Platform = 'linux') {
  const reads: string[] = [];
  const readServer: ReadWorkspaceServer = async (directory) => {
    reads.push(directory);
    return server === undefined ? undefined : { root: GAME, server };
  };
  return { servers: new WorkspaceServers(readServer, platform), reads };
}

describe('WorkspaceServers', () => {
  it("knows no workspace's server until its header was read", () => {
    expect(servers('acme@cloud').servers.serverOf(GAME)).toBeUndefined();
  });

  it("remembers a workspace's server as its header is read, for the workspace and every folder in it", async () => {
    const { servers: known } = servers(undefined);

    const status = await known.remembering(readers('acme@cloud')).status(GAME);

    expect(status.server).toBe('acme@cloud');
    expect(known.serverOf(GAME)).toBe('acme@cloud');
    expect(known.serverOf(join(GAME, 'Assets', 'Scripts'))).toBe('acme@cloud');
    expect(known.serverOf(join('/wkspaces', 'game2'))).toBeUndefined();
  });

  it('takes a Windows workspace by its folder whatever the case', async () => {
    const { servers: known } = servers(undefined, 'win32');

    await known.remembering(readers('local')).status('C:\\wkspaces\\Game');

    expect(known.serverOf('c:\\wkspaces\\game\\Assets')).toBe('local');
  });

  it("learns a workspace's server with one local read when a command failed before its header was read", async () => {
    const { servers: known, reads } = servers('acme@cloud');

    expect(await known.learn(GAME)).toBe('acme@cloud');
    expect(await known.learn(GAME)).toBe('acme@cloud');

    expect(reads).toEqual([GAME]);
    expect(known.serverOf(GAME)).toBe('acme@cloud');
  });

  it('reads nothing for a server it knows, and learns none for a folder in no workspace', async () => {
    const { servers: known, reads } = servers(undefined);
    await known.remembering(readers('local')).status(GAME);

    expect(await known.learn(GAME)).toBe('local');
    expect(reads).toEqual([]);
    expect(await known.learn(join('/elsewhere'))).toBeUndefined();
  });

  it("remembers a server learned from a folder in the workspace under the workspace's root, for all its folders", async () => {
    const { servers: known } = servers('acme@cloud');

    await known.learn(join(GAME, 'Assets'));

    expect(known.serverOf(GAME)).toBe('acme@cloud');
    expect(known.serverOf(join(GAME, 'src'))).toBe('acme@cloud');
  });

  it('never waits on its own read: a read failing as a sign-in would asks to learn the same folder again', async () => {
    let known!: WorkspaceServers;
    let nested: string | undefined | 'unset' = 'unset';
    known = new WorkspaceServers(async (directory) => {
      nested = await known.learn(directory);
      return { root: directory, server: 'acme@cloud' };
    }, 'linux');

    expect(await known.learn(GAME)).toBe('acme@cloud');
    expect(nested).toBeUndefined();
  });
});
