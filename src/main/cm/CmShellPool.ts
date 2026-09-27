import { CmShellSession } from './CmShellSession';
import type { CmResult } from './CmResult';

const SESSIONS_PER_DIRECTORY = 2;
/** A directory no command ran in for this long lets its sessions go (a workspace no window shows anymore). */
export const IDLE_DIRECTORY_MS = 10 * 60_000;

type Session = Pick<CmShellSession, 'pendingCount' | 'isReady' | 'start' | 'run' | 'dispose'>;
type CreateSession = (cwd: string) => Session;

interface Waiting {
  args: string[];
  resolve: (result: CmResult) => void;
  reject: (error: Error) => void;
}

interface Directory {
  sessions: Session[];
  /** Commands waiting for a session to be free: the first one free takes the next, so a slow command holds up none. */
  waiting: Waiting[];
  idleTimer: NodeJS.Timeout | null;
}

/**
 * Keeps a few `cm shell` sessions per working directory so independent queries don't wait on each other, and lets
 * them go once the directory is idle: each one is a process of about 100 MB.
 */
export class CmShellPool {
  private readonly directories = new Map<string, Directory>();

  constructor(
    cmPath: string,
    private readonly createSession: CreateSession = (cwd) => new CmShellSession(cmPath, cwd),
  ) {}

  run(cwd: string, args: string[]): Promise<CmResult> {
    const directory = this.directory(cwd);
    return new Promise((resolve, reject) => {
      directory.waiting.push({ args, resolve, reject });
      this.dispatch(cwd, directory);
    });
  }

  /**
   * Whether a session in the directory answers commands at once. Otherwise they start (about a second), and a query
   * is quicker as a process of its own meanwhile.
   */
  isReady(cwd: string): boolean {
    this.warmUp(cwd);
    return this.directories.get(cwd)!.sessions.some((session) => session.isReady);
  }

  /** Starts the sessions for a directory so the first queries there don't pay the startup cost. */
  warmUp(cwd: string): void {
    const directory = this.directory(cwd);
    while (directory.sessions.length < SESSIONS_PER_DIRECTORY) directory.sessions.push(this.createSession(cwd));
    for (const session of directory.sessions) {
      // A session answering its first command is free for the commands waiting, and may leave the directory idle.
      void session.start().then(() => {
        if (this.directories.get(cwd) !== directory) return;
        this.dispatch(cwd, directory);
        this.whenIdle(cwd, directory);
      });
    }
    this.whenIdle(cwd, directory);
  }

  disposeAll(): void {
    for (const directory of this.directories.values()) this.disposeDirectory(directory);
    this.directories.clear();
  }

  private directory(cwd: string): Directory {
    let directory = this.directories.get(cwd);
    if (!directory) {
      directory = { sessions: [], waiting: [], idleTimer: null };
      this.directories.set(cwd, directory);
    }
    if (directory.idleTimer) clearTimeout(directory.idleTimer);
    directory.idleTimer = null;
    return directory;
  }

  private dispatch(cwd: string, directory: Directory): void {
    while (directory.waiting.length > 0) {
      const session = this.freeSession(cwd, directory);
      if (!session) return;
      const { args, resolve, reject } = directory.waiting.shift()!;
      session
        .run(args)
        .then(resolve, reject)
        .finally(() => {
          if (this.directories.get(cwd) !== directory) return;
          this.dispatch(cwd, directory);
          this.whenIdle(cwd, directory);
        });
    }
  }

  private freeSession(cwd: string, directory: Directory): Session | undefined {
    const idle = directory.sessions.find((session) => session.pendingCount === 0);
    if (idle || directory.sessions.length >= SESSIONS_PER_DIRECTORY) return idle;
    const created = this.createSession(cwd);
    directory.sessions.push(created);
    return created;
  }

  private whenIdle(cwd: string, directory: Directory): void {
    if (directory.idleTimer || directory.waiting.length > 0 || directory.sessions.some((session) => session.pendingCount > 0)) return;
    directory.idleTimer = setTimeout(() => {
      this.disposeDirectory(directory);
      this.directories.delete(cwd);
    }, IDLE_DIRECTORY_MS);
    // Waiting to let the sessions go is no reason to keep the app running.
    directory.idleTimer.unref();
  }

  private disposeDirectory(directory: Directory): void {
    if (directory.idleTimer) clearTimeout(directory.idleTimer);
    directory.idleTimer = null;
    directory.sessions.forEach((session) => session.dispose());
    directory.waiting.splice(0).forEach((command) => command.reject(new Error('cm shell session was closed')));
  }
}
