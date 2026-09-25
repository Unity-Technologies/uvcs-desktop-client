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
