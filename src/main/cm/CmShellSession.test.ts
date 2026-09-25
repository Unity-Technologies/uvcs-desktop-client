import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { CmShellSession } from './CmShellSession';

const fakeCm = fileURLToPath(new URL('./testing/fakeCmShell.mjs', import.meta.url));
let session: CmShellSession;

afterEach(() => session.dispose());

describe('CmShellSession', () => {
  it('runs commands in order and reports their exit codes', async () => {
    session = new CmShellSession(fakeCm, process.cwd());
    const [first, second] = await Promise.all([session.run(['echo', 'hello']), session.run(['fail'])]);
    expect(first).toEqual({ output: 'hello', exitCode: 0 });
    expect(second.exitCode).toBe(1);
  });

  it('fails a command stuck on a prompt without feeding it the next commands', async () => {
    session = new CmShellSession(fakeCm, process.cwd());
    const prompted = session.run(['prompt']);
    const next = session.run(['echo', 'still-works']);

    await expect(prompted).rejects.toThrow(/waiting for input/);
    await expect(next).resolves.toEqual({ output: 'still-works', exitCode: 0 });
  });

  it('does not take output paused on a colon for a prompt while the main process is busy', async () => {
    session = new CmShellSession(fakeCm, process.cwd());
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
