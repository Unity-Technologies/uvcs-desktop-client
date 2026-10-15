// A Unity Cloud organization's server has two names. People use, and `cm` prints and takes almost everywhere, the
// organization's own (`AcmeStudio@unity`); UVCS keeps it underneath by the organization's id (`2398571046213@cloud`).
// A few things print that id form: `cm status --xml` (its header's server and selector), `cm history --xml`, and the
// workspace's `.plastic/plastic.selector`, which the app reads without `cm`. Both name the same server but compare
// unequal, so the app never shows, compares or passes the id form: what it reads there is named here first.

import type { CmClient } from './CmClient';
import { machineReadableHeaderArgs, parseMachineReadableHeader } from './workspaceStatus';

/** `2398571046213@cloud`: a Unity organization's server by its id, as `cm` keeps it underneath. */
export function isOrganizationIdServer(server: string): boolean {
  return /^\d+@cloud$/.test(server);
}

/**
 * The names of the Unity organizations' servers, by their ids, for the session. Each is learned from a workspace on
 * it, with one local `cm status --header --machinereadable` (which names the server as people do) the first time the
 * id shows: one command per organization per session, never per workspace or read. Any other server is its own name.
 */
export class OrganizationServers {
  private readonly learning = new Map<string, Promise<string>>();
  private readonly learned = new Map<string, string>();

  constructor(private readonly cm: Pick<CmClient, 'query'>) {}

  /**
   * `server` by name, for the workspace at `workspacePath`, which is on it (as its status header or selector file
   * said). `cwd` is where `cm` runs: the workspace's own sessions, or the home folder's for a list of workspaces. Should
   * `cm` not answer, the id stays, asked again the next time.
   */
  nameOfWorkspaceServer(workspacePath: string, server: string, cwd?: string): Promise<string> {
    if (!isOrganizationIdServer(server)) return Promise.resolve(server);
    const known = this.learned.get(server);
    if (known) return Promise.resolve(known);
    let learning = this.learning.get(server);
    if (!learning) {
      learning = this.learn(workspacePath, server, cwd);
      this.learning.set(server, learning);
    }
    return learning;
  }

  /**
   * `server` by the name learned for it (`nameOfWorkspaceServer`), else as given: for a server some output names that
   * isn't sure to be a workspace's (a revision's in `cm history`), which only the workspace's own can name.
   */
  nameOf(server: string): string {
    return this.learned.get(server) ?? server;
  }

  private async learn(workspacePath: string, server: string, cwd: string | undefined): Promise<string> {
    try {
      const output = await this.cm.query(machineReadableHeaderArgs(workspacePath), cwd === undefined ? {} : { cwd });
      const name = parseMachineReadableHeader(output)?.server;
      if (!name) return server;
      this.learned.set(server, name);
      return name;
    } catch {
      return server;
    } finally {
      this.learning.delete(server);
    }
  }
}
