import { isSameOrInside } from '../files/pathContainment';
import type { HeaderReaders } from './WorkspaceHeaders';

/**
 * The server of each workspace, learned from the header every window reads as it opens one (`workspaces.info`), so
 * the sign-in gate knows a workspace command's server with no command of its own (`SignInGate.serverOf`). A workspace
 * whose header wasn't read yet has none: its commands aren't gated until it is.
 */
export class WorkspaceServers {
  private readonly servers = new Map<string, string>();

  constructor(private readonly platform: NodeJS.Platform = process.platform) {}

  /** The readers of `WorkspaceHeaders`, remembering each workspace's server as its header is read. */
  remembering(readers: HeaderReaders): HeaderReaders {
    return {
      ...readers,
      status: async (workspacePath) => {
        const status = await readers.status(workspacePath);
        if (status.server) this.servers.set(workspacePath, status.server);
        return status;
      },
    };
  }

  /** The server of the workspace holding `directory` (its root, or a folder in it), or undefined when not known. */
  serverOf(directory: string): string | undefined {
    const exact = this.servers.get(directory);
    if (exact !== undefined) return exact;
    for (const [workspacePath, server] of this.servers) if (isSameOrInside(workspacePath, directory, this.platform)) return server;
    return undefined;
  }
}
