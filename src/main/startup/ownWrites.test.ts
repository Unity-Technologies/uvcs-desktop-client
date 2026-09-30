import { describe, expect, it } from 'vitest';
import { ignoreOwnCommandWrites } from './ownWrites';

type StartedListener = Parameters<Parameters<typeof ignoreOwnCommandWrites>[0]['onCommandStarted']>[0];

/** A `cm` whose commands the test starts, and what the watchers and headers were told. */
function setUp() {
  let listener: StartedListener = () => {};
  const ignored: string[] = [];
  const forgotten: string[] = [];
  ignoreOwnCommandWrites(
    { onCommandStarted: (started) => ((listener = started), () => {}) },
    { ignoreOwnWrite: (_write, cwd, only) => void ignored.push([cwd, only].filter(Boolean).join(' ')) },
    { forget: (workspacePath) => void forgotten.push(workspacePath) },
  );
  const run = async (args: string[], outcome: 'succeeds' | 'fails' = 'succeeds'): Promise<void> => {
    const finished = outcome === 'succeeds' ? Promise.resolve() : Promise.reject(new Error('cm failed'));
    listener({ args, cwd: '/wk/game', finished });
    await finished.catch(() => undefined);
  };
  return { run, ignored, forgotten: () => forgotten };
}

describe('ignoreOwnCommandWrites', () => {
  it("drops a write's events in the workspace it runs in, and reads that workspace, only, again as it starts and ends", async () => {
    const { run, ignored, forgotten } = setUp();

    await run(['checkin', '/wk/game/a.txt']);
    expect(ignored).toEqual(['/wk/game']);
    expect(forgotten()).toEqual(['/wk/game', '/wk/game']);
  });

  it('reads the workspace again after a write that failed too', async () => {
    const { run, forgotten } = setUp();

    await run(['undo', '/wk/game/a.txt'], 'fails');
    expect(forgotten()).toEqual(['/wk/game', '/wk/game']);
  });

  it('drops only the changelist rewrites of a status read, and forgets nothing', async () => {
    const { run, ignored, forgotten } = setUp();

    await run(['status', '--xml', '--changelists']);
    expect(ignored).toEqual(['/wk/game changelists']);
    expect(forgotten()).toEqual([]);
  });

  it('leaves other reads alone', async () => {
    const { run, ignored, forgotten } = setUp();

    await run(['find', 'changeset']);
    expect(ignored).toEqual([]);
    expect(forgotten()).toEqual([]);
  });
});
