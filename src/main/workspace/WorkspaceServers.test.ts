import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { WorkspaceStatus } from '../cm/workspaceStatus';
import type { HeaderReaders } from './WorkspaceHeaders';
import { WorkspaceServers } from './WorkspaceServers';

const GAME = join('/wkspaces', 'game');

function readers(server: string): HeaderReaders {
  const status = { server } as WorkspaceStatus;
  return { status: async () => status, names: async () => ({ name: 'game', guid: 'g' }) };
}

describe('WorkspaceServers', () => {
  it("knows no workspace's server until its header was read", () => {
    expect(new WorkspaceServers().serverOf(GAME)).toBeUndefined();
  });

  it("remembers a workspace's server as its header is read, for the workspace and every folder in it", async () => {
    const servers = new WorkspaceServers();

    const status = await servers.remembering(readers('acme@cloud')).status(GAME);

    expect(status.server).toBe('acme@cloud');
    expect(servers.serverOf(GAME)).toBe('acme@cloud');
    expect(servers.serverOf(join(GAME, 'Assets', 'Scripts'))).toBe('acme@cloud');
    expect(servers.serverOf(join('/wkspaces', 'game2'))).toBeUndefined();
  });

  it('takes a Windows workspace by its folder whatever the case', async () => {
    const servers = new WorkspaceServers('win32');

    await servers.remembering(readers('local')).status('C:\\wkspaces\\Game');

    expect(servers.serverOf('c:\\wkspaces\\game\\Assets')).toBe('local');
  });
});
