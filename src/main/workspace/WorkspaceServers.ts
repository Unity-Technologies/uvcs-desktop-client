import { isSameOrInside } from '../files/pathContainment';
import type { HeaderReaders } from './WorkspaceHeaders';

/** Reads the server of the workspace holding a folder, locally (`readWorkspaceServer`); undefined when there is none. */
export type ReadWorkspaceServer = (directory: string) => Promise<string | undefined>;

/**
 * The server of each workspace, learned from the header every window reads as it opens one (`workspaces.info`), so
 * the sign-in gate knows a workspace command's server with no command of its own (`SignInGate.serverOf`). A workspace
 * whose header wasn't read yet has none: its commands aren't gated until it is, and one failing for a sign-in learns it
 * with a local read (`learn`): the header's own read asks the server for its branch head, and fails so.
 */
export class WorkspaceServers {
  private readonly servers = new Map<string, string>();
  private readonly learning = new Set<string>();

  constructor(
    private readonly readServer: ReadWorkspaceServer,
    private readonly platform: NodeJS.Platform = process.platform,
  ) {}

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

  /**
   * The server of the workspace holding `directory`, read now when not known, and remembered: for a command there that
   * failed for a sign-in before its workspace's header was read. A read of the same folder already under way answers
   * undefined: the read itself failing for a sign-in never waits on itself.
   */
  async learn(directory: string): Promise<string | undefined> {
    const known = this.serverOf(directory);
    if (known !== undefined || this.learning.has(directory)) return known;
    this.learning.add(directory);
    try {
      const server = await this.readServer(directory);
      if (server) this.servers.set(directory, server);
      return server;
    } finally {
      this.learning.delete(directory);
    }
  }
}
