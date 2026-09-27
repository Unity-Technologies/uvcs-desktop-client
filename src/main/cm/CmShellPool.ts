import { CmShellSession } from './CmShellSession';
import type { CmResult } from './CmResult';

const SESSIONS_PER_DIRECTORY = 2;

/** Keeps a few `cm shell` sessions per working directory so independent queries don't wait on each other. */
export class CmShellPool {
  private readonly sessionsByDirectory = new Map<string, CmShellSession[]>();

  constructor(private readonly cmPath: string) {}

  run(cwd: string, args: string[]): Promise<CmResult> {
    return this.leastBusySession(cwd).run(args);
  }

  /**
   * Whether a session in the directory answers commands at once. Otherwise they start (about a second), and a query
   * is quicker as a process of its own meanwhile.
   */
  isReady(cwd: string): boolean {
    this.warmUp(cwd);
    return this.sessionsByDirectory.get(cwd)!.some((session) => session.isReady);
  }

  /** Starts the sessions for a directory so the first queries there don't pay the startup cost. */
  warmUp(cwd: string): void {
    const sessions = this.sessionsByDirectory.get(cwd) ?? [];
    while (sessions.length < SESSIONS_PER_DIRECTORY) sessions.push(new CmShellSession(this.cmPath, cwd));
    this.sessionsByDirectory.set(cwd, sessions);
    sessions.forEach((session) => session.start());
  }

  disposeAll(): void {
    this.sessionsByDirectory.forEach((sessions) => sessions.forEach((session) => session.dispose()));
    this.sessionsByDirectory.clear();
  }

  private leastBusySession(cwd: string): CmShellSession {
    const sessions = this.sessionsByDirectory.get(cwd) ?? [];
    this.sessionsByDirectory.set(cwd, sessions);

    const idle = sessions.find((session) => session.pendingCount === 0);
    if (idle) return idle;

    if (sessions.length < SESSIONS_PER_DIRECTORY) {
      const created = new CmShellSession(this.cmPath, cwd);
      sessions.push(created);
      return created;
    }

    return sessions.reduce((a, b) => (a.pendingCount <= b.pendingCount ? a : b));
  }
}
