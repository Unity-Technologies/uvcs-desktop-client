import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { CmShellSession, resultLineAtEnd, shellCommandTimeoutMs } from './CmShellSession';

// `node shell` in the fake's folder, as the session runs `<cm> shell`.
const fakeCmFolder = fileURLToPath(new URL('./testing/fakeCmShell', import.meta.url));
let session: CmShellSession;

afterEach(() => session?.dispose());

describe('CmShellSession', () => {
  it('runs commands in order and reports their exit codes', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    const [first, second] = await Promise.all([session.run(['echo', 'hello']), session.run(['fail'])]);
    expect(first).toEqual({ output: 'hello', exitCode: 0 });
    expect(second.exitCode).toBe(1);
  });

  it('fails a command stuck on a prompt without feeding it the next commands', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
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

  it('does not take output paused on a colon for a prompt while the main process is busy', async () => {
    session = new CmShellSession(process.execPath, fakeCmFolder);
    await session.run(['echo', 'started']);
    const paused = session.run(['pause']);
    await new Promise((resolve) => setTimeout(resolve, 100));
    // Busy past the prompt stall (e.g. parsing a huge output): the rest of the line arrives meanwhile, and on the next
    // turn of the event loop the timer fires before it is read.
    await new Promise<void>((resolve) =>
      setImmediate(() => {
        const busyUntil = Date.now() + 1800;
        while (Date.now() < busyUntil);
        resolve();
      }),
    );

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

describe('resultLineAtEnd', () => {
  it('finds the result line ending the output', () => {
    expect(resultLineAtEnd('hello\nCommandResult 0\n')).toEqual({ index: 5, exitCode: 0 });
    expect(resultLineAtEnd('CommandResult -1\r\n')).toEqual({ index: 0, exitCode: -1 });
  });

  it('ignores result lines with output after them, and text that only ends like one', () => {
    expect(resultLineAtEnd('CommandResult 0\nmore')).toBeNull();
    expect(resultLineAtEnd('hello\nCommandResult 0')).toBeNull();
    expect(resultLineAtEnd('see CommandResult 0\n')).toBeNull();
  });
});
