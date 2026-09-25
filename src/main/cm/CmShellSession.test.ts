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
});
