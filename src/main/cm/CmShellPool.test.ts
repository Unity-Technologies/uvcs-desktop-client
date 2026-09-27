import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CmResult } from './CmResult';
import { CmShellPool, IDLE_DIRECTORY_MS } from './CmShellPool';

/** A session whose commands finish when the test says so. */
class FakeSession {
  static created: FakeSession[] = [];
  readonly ran: string[] = [];
  disposed = false;
  private readonly running: { command: string; finish: (result: CmResult) => void }[] = [];

  constructor(readonly cwd: string) {
    FakeSession.created.push(this);
  }

  get pendingCount(): number {
    return this.running.length;
  }

  start(): void {}

  run(args: string[]): Promise<CmResult> {
    this.ran.push(args.join(' '));
    return new Promise((finish) => this.running.push({ command: args.join(' '), finish }));
  }

  finish(command: string): void {
    const index = this.running.findIndex((running) => running.command === command);
    this.running.splice(index, 1)[0]!.finish({ output: command, exitCode: 0 });
  }

  dispose(): void {
    this.disposed = true;
  }
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

let pool: CmShellPool;
beforeEach(() => {
  FakeSession.created = [];
  pool = new CmShellPool('cm', (cwd) => new FakeSession(cwd));
});
afterEach(() => {
  pool.disposeAll();
  vi.useRealTimers();
});

describe('CmShellPool', () => {
  it('runs a command in the first session to be free, so a slow one holds up nothing', async () => {
    const slow = pool.run('/wk', ['status']);
    void pool.run('/wk', ['status', '--header']);
    const next = pool.run('/wk', ['getworkspacefrompath']);
    const [first, second] = FakeSession.created;
    expect(FakeSession.created).toHaveLength(2);

    second!.finish('status --header');
    await settle();
    expect(second!.ran).toEqual(['status --header', 'getworkspacefrompath']);
    second!.finish('getworkspacefrompath');
    await expect(next).resolves.toEqual({ output: 'getworkspacefrompath', exitCode: 0 });

    first!.finish('status');
    await expect(slow).resolves.toMatchObject({ output: 'status' });
  });

  it('keeps sessions apart per directory', () => {
    void pool.run('/a', ['status']);
    void pool.run('/b', ['status']);
    expect(FakeSession.created.map((session) => session.cwd)).toEqual(['/a', '/b']);
  });

  it('lets the sessions of a directory go once it has been idle a while, and starts new ones when needed', async () => {
    vi.useFakeTimers();
    void pool.run('/wk', ['status']);
    const [session] = FakeSession.created;
    vi.advanceTimersByTime(IDLE_DIRECTORY_MS * 2);
    expect(session!.disposed).toBe(false);

    session!.finish('status');
    await vi.advanceTimersByTimeAsync(IDLE_DIRECTORY_MS - 1000);
    void pool.run('/wk', ['status']);
    session!.finish('status');
    await vi.advanceTimersByTimeAsync(IDLE_DIRECTORY_MS - 1000);
    expect(session!.disposed).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    expect(session!.disposed).toBe(true);
    void pool.run('/wk', ['status']);
    expect(FakeSession.created).toHaveLength(2);
  });
});
