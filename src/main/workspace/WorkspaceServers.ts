import { isSameOrInside } from '../files/pathContainment';
import type { HeaderReaders } from './WorkspaceHeaders';

/**
 * Reads the root and server of the workspace holding a folder, locally (`findWorkspaceRoot`, `readWorkspaceServer`);
 * undefined when there is none.
 */
export type ReadWorkspaceServer = (directory: string) => Promise<{ root: string; server: string } | undefined>;

/**
 * The server of each workspace, learned from the header every window reads as it opens one (`workspaces.info`), so
 * the sign-in gate knows a workspace command's server with no command of its own (`SignInGate.serverOf`). A workspace
 * whose header wasn't read yet has none: its commands aren't gated until it is, and one failing for a sign-in learns it
 * with a local read (`learn`): the header's own read asks the server for its branch head, and fails so.
 */
export class WorkspaceServers {
  private readonly servers = new Map<string, string>();
  private readonly learning = new Map<string, Promise<string | undefined>>();

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
   * The server of the workspace holding `directory`, read now when not known, and remembered under the workspace's root
   * (so its every folder knows it): for a command there that failed for a sign-in before its workspace's header was
   * read. Failures learning the same folder at once share one read. Its reads name the folder and run in any directory
   * (`readWorkspaceOrigin`), so they never learn themselves.
   */
  learn(directory: string): Promise<string | undefined> {
    const known = this.serverOf(directory);
    if (known !== undefined) return Promise.resolve(known);
    const running = this.learning.get(directory);
    if (running) return running;
    const learning = this.readServer(directory)
      .then((read) => {
        if (read) this.servers.set(read.root, read.server);
        return read?.server;
      })
      .finally(() => this.learning.delete(directory));
    this.learning.set(directory, learning);
    return learning;
  }

}
