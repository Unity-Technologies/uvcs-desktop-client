import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CmResult } from './CmResult';
import { CmShellPool, IDLE_DIRECTORY_MS } from './CmShellPool';

/** A session whose commands finish when the test says so. */
class FakeSession {
  static created: FakeSession[] = [];
  readonly ran: string[] = [];
  disposed = false;
  started = false;
  answerFirstCommand = (): void => {};
  private starting: Promise<void> | null = null;
  private readonly running: { command: string; finish: (result: CmResult) => void }[] = [];

  constructor(readonly cwd: string) {
    FakeSession.created.push(this);
  }

  get pendingCount(): number {
    return this.running.length + (this.starting ? 1 : 0);
  }

  get isReady(): boolean {
    return this.started;
  }

  /** Until the test calls `answerFirstCommand`, the session is starting. */
  start(): Promise<void> {
    if (this.started) return Promise.resolve();
    this.starting ??= new Promise((resolve) => {
      this.answerFirstCommand = () => {
        this.started = true;
        this.starting = null;
        resolve();
      };
    });
    return this.starting;
  }

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
  it('is not ready in a directory until one of its sessions answered', () => {
    expect(pool.isReady('/wk')).toBe(false);
    pool.warmUp('/wk');
    expect(pool.isReady('/wk')).toBe(false);
    expect(FakeSession.created).toHaveLength(2);

    FakeSession.created[1]!.answerFirstCommand();
    expect(pool.isReady('/wk')).toBe(true);
    expect(pool.isReady('/other')).toBe(false);
  });

  it('runs the commands waiting for a starting session as soon as it answered', async () => {
    pool.warmUp('/wk');
    const waiting = pool.run('/wk', ['status']);
    const [first] = FakeSession.created;
    expect(first!.ran).toEqual([]);

    first!.answerFirstCommand();
    await settle();
    expect(first!.ran).toEqual(['status']);
    first!.finish('status');
    await expect(waiting).resolves.toMatchObject({ output: 'status' });
  });

  it('is not ready again once an idle directory let its sessions go, until the new ones answer', async () => {
    vi.useFakeTimers();
    pool.warmUp('/wk');
    FakeSession.created.forEach((session) => session.answerFirstCommand());
    await vi.advanceTimersByTimeAsync(0);
    expect(pool.isReady('/wk')).toBe(true);

    await vi.advanceTimersByTimeAsync(IDLE_DIRECTORY_MS);
    expect(FakeSession.created.every((session) => session.disposed)).toBe(true);
    pool.warmUp('/wk');
    expect(pool.isReady('/wk')).toBe(false);
    expect(FakeSession.created).toHaveLength(4);
  });

  it("lets a released workspace's sessions go once their commands are done, and starts new ones when needed", async () => {
    const running = pool.run('/wk', ['status']);
    const [busy] = FakeSession.created;
    pool.release('/wk');
    expect(busy!.disposed).toBe(false);

    busy!.finish('status');
    await expect(running).resolves.toMatchObject({ output: 'status' });
    await settle();
    expect(busy!.disposed).toBe(true);
    void pool.run('/wk', ['status']);
    expect(FakeSession.created).toHaveLength(2);
  });

  it("keeps a released workspace's sessions when a command comes before they are done", async () => {
    void pool.run('/wk', ['status']);
    const [session] = FakeSession.created;
    pool.release('/wk');
    void pool.run('/wk', ['status', '--header']);
    session!.finish('status');
    await settle();
    expect(session!.disposed).toBe(false);
  });
});
