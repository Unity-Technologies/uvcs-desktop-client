import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CmShellSession, shellCommandTimeoutMs } from './CmShellSession';

// Every session runs the fake below, but one test's, whose output comes in step with fake timers.
vi.mock('node:child_process', async (importOriginal) => {
  const childProcess = await importOriginal<typeof import('node:child_process')>();
  return { ...childProcess, spawn: vi.fn(childProcess.spawn) };
});

// `node shell` in the fake's folder, as the session runs `<cm> shell`.
const fakeCmFolder = fileURLToPath(new URL('./testing/fakeCmShell', import.meta.url));
let session: CmShellSession;

afterEach(() => {
  session?.dispose();
  vi.useRealTimers();
});

/** A `cm shell` process whose output the test prints, as it pleases. */
function printedShellProcess() {
  const stdout = Object.assign(new EventEmitter(), { setEncoding: () => stdout });
  const stderr = Object.assign(new EventEmitter(), { setEncoding: () => stderr });
  const process = Object.assign(new EventEmitter(), { stdout, stderr, stdin: { write: () => true, end: () => {} }, kill: () => true });
  return { process: process as unknown as ChildProcessWithoutNullStreams, print: (text: string) => void stdout.emit('data', text) };
}

describe('CmShellSession', () => {
  it('runs commands in order and reports their exit codes', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    const [first, second] = await Promise.all([session.run(['echo', 'hello']), session.run(['fail'])]);
    expect(first).toEqual({ output: 'hello', exitCode: 0 });
    expect(second.exitCode).toBe(1);
  });

  it('fails a command stuck on a prompt without feeding it the next commands', async () => {
    // Nothing follows the fake's prompt, so any stall tells it; the real one would only make the test wait.
    session = new CmShellSession(process.execPath, fakeCmFolder, 50);
    const prompted = session.run(['prompt']);
    const next = session.run(['echo', 'still-works']);

    await expect(prompted).rejects.toThrow(/waiting for input/);
    await expect(next).resolves.toEqual({ output: 'still-works', exitCode: 0 });
  });

  it('reads Windows line breaks as the app\'s, the one before the result line included', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    await expect(session.run(['crlf', 'first'])).resolves.toEqual({ output: 'first\nsecond line', exitCode: 0 });
  });

  it('ends a command at its last result line, not at one quoted in its output', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    const [quoted, next] = await Promise.all([session.run(['quote']), session.run(['echo', 'in-step'])]);
    expect(quoted).toEqual({ output: '>cm shell\nCommandResult 0\nstill the comment', exitCode: 0 });
    expect(next).toEqual({ output: 'in-step', exitCode: 0 });
  });

  it('fails the running command when cm shell ends, and runs the next ones on a new process', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    const ended = session.run(['exit']);
    const next = session.run(['echo', 'restarted']);

    await expect(ended).rejects.toThrow('cm shell exited unexpectedly');
    await expect(next).resolves.toEqual({ output: 'restarted', exitCode: 0 });
  });

  it('stops a read that takes longer than two minutes', async () => {
    vi.useFakeTimers();
    const shell = printedShellProcess();
    vi.mocked(spawn).mockReturnValueOnce(shell.process);
    session = new CmShellSession('cm', '/wk');
    const stuck = session.run(['find', 'changeset']);
    shell.print('Searching...\n');

    vi.advanceTimersByTime(shellCommandTimeoutMs(['find', 'changeset']));

    await expect(stuck).rejects.toThrow('took too long');
  });

  it('does not take output paused on a colon for a prompt while the main process is busy', async () => {
    vi.useFakeTimers();
    const shell = printedShellProcess();
    vi.mocked(spawn).mockReturnValueOnce(shell.process);
    session = new CmShellSession('cm', '/wk');
    const paused = session.run(['status']);
    shell.print('2026-09-25T10:');

    // Busy past the prompt stall (e.g. parsing a huge output): the rest of the line arrives meanwhile, and on the next
    // turn of the event loop the stall's timer fires before it is read.
    vi.advanceTimersToNextTimer();
    shell.print('11:12\nCommandResult 0\n');
    await vi.runOnlyPendingTimersAsync();

    await expect(paused).resolves.toEqual({ output: '2026-09-25T10:11:12', exitCode: 0 });
  });
});

describe('shellCommandTimeoutMs', () => {
  it('gives writes to thousands of files minutes, where a read gets two', () => {
    expect(shellCommandTimeoutMs(['status', '--xml'])).toBe(120_000);
    expect(shellCommandTimeoutMs(['undo', '-r', '/wk'])).toBeGreaterThanOrEqual(30 * 60_000);
    expect(shellCommandTimeoutMs(['add', '--coparent', '/wk/a'])).toBeGreaterThanOrEqual(30 * 60_000);
  });
});
