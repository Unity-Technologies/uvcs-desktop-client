import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CmClient } from './CmClient';
import { isServerCommand, RepeatedCommandDetector, warnOnRepeatedServerCommands } from './repeatedCommands';

describe('isServerCommand', () => {
  it('tells server queries from reads of this machine', () => {
    expect(isServerCommand(['find', 'branch', '--xml'])).toBe(true);
    expect(isServerCommand(['diff', 'cs:4'])).toBe(true);
    expect(isServerCommand(['workspace', 'create', 'wk', '/tmp/wk'])).toBe(true);
    expect(isServerCommand(['status', '--header', '--xml'])).toBe(false);
    expect(isServerCommand(['getworkspacefrompath', '/wk'])).toBe(false);
    expect(isServerCommand(['workspace', 'list'])).toBe(false);
  });
});

describe('RepeatedCommandDetector', () => {
  const budget = { maxRuns: 2, windowMs: 10_000 };

  it('flags the run that goes over the budget, once per burst', () => {
    const detector = new RepeatedCommandDetector(budget);
    expect([0, 1000, 2000, 3000].map((at) => detector.record('cm find branch', at))).toEqual([false, false, true, false]);
  });

  it('counts only the runs within the window', () => {
    const detector = new RepeatedCommandDetector(budget);
    expect([0, 6000, 12_000, 18_000].map((at) => detector.record('cm find branch', at))).toEqual([false, false, false, false]);
  });

  it('counts each command apart', () => {
    const detector = new RepeatedCommandDetector(budget);
    expect(['a', 'b', 'a', 'b'].map((command, index) => detector.record(command, index))).toEqual([false, false, false, false]);
  });
});

describe('warnOnRepeatedServerCommands', () => {
  type StartListener = Parameters<CmClient['onCommandStarted']>[0];

  function watchedCommands() {
    let started: StartListener = () => undefined;
    warnOnRepeatedServerCommands({ onCommandStarted: (listener) => ((started = listener), () => undefined) });
    return (args: string[], cwd = '/wk') => started({ args, cwd, finished: Promise.resolve() });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('warns once when a server command runs a third time within ten seconds, secrets hidden', () => {
    const run = watchedCommands();
    const sync = ['sync', 'game@local', 'git', 'https://github.com/acme/game.git', '--pwd=s3cret'];

    for (let i = 0; i < 4; i++) {
      run(sync);
      vi.advanceTimersByTime(1000);
    }

    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(vi.mocked(console.warn).mock.calls[0]?.[0]).toContain('[server budget] cm sync game@local git https://github.com/acme/game.git --pwd=•••');
    expect(vi.mocked(console.warn).mock.calls[0]?.[0]).not.toContain('s3cret');
  });

  it('never warns about local reads, or the same command in different workspaces', () => {
    const run = watchedCommands();

    for (let i = 0; i < 5; i++) run(['status', '--header', '--xml']);
    ['/a', '/b', '/c'].forEach((cwd) => run(['find', 'branch'], cwd));

    expect(console.warn).not.toHaveBeenCalled();
  });
});
