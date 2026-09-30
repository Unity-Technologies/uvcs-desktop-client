import { createServer, type AddressInfo, type Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { launchMergeTool, spawnCommand } from './launch';

/** A tool made of a Node script, so the launch is tested the same on every OS. */
const tool = (script: string): [string, string[]] => [process.execPath, ['-e', script]];

/**
 * A launcher script: it starts an app that shares its output and runs until let go, connecting to `port` once it has
 * started (so the test knows), then waits too. The app quits when the connection closes.
 */
function launcherOfAnApp(port: number): string {
  const app = `const link = require('node:net').connect(${port}); link.on('close', () => process.exit()); link.on('error', () => process.exit()); setInterval(() => {}, 1000);`;
  return `require('node:child_process').spawn(process.execPath, ['-e', ${JSON.stringify(app)}], { stdio: 'inherit' }); setInterval(() => {}, 1000);`;
}

/** Listens for the app a launcher starts: resolves with its connection once it has started. */
async function appListener(): Promise<{ port: number; appStarted: Promise<Socket>; close: () => void }> {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const appStarted = new Promise<Socket>((resolve) => server.once('connection', resolve));
  return { port: (server.address() as AddressInfo).port, appStarted, close: () => server.close() };
}

afterEach(() => vi.useRealTimers());

describe('launchMergeTool', () => {
  it('is done as soon as a stopped tool exits, even while something it started still holds its output', async () => {
    const listener = await appListener();
    const stop = new AbortController();
    const run = launchMergeTool(...tool(launcherOfAnApp(listener.port)), stop.signal);
    const app = await listener.appStarted;

    stop.abort();

    // Waiting for the output to close would wait for the app, which runs until let go below.
    await expect(run).resolves.toMatchObject({ exitCode: null, errorOutput: '' });
    app.destroy();
    listener.close();
  });

  it('tells how long the tool ran, in seconds', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const run = launchMergeTool(...tool(''), new AbortController().signal);
    vi.setSystemTime(Date.now() + 1500);
    expect((await run).seconds).toBe(1.5);
  });

  it('reports how a tool that ran to the end exited', async () => {
    await expect(launchMergeTool(...tool("console.error('oops'); process.exit(3)"), new AbortController().signal)).resolves.toMatchObject({
      exitCode: 3,
      errorOutput: 'oops',
    });
  });
});

describe('spawnCommand', () => {
  it('runs programs directly, and Windows .cmd launchers through cmd.exe with every argument quoted', () => {
    expect(spawnCommand('darwin', '/bin/tool', ['a b'])).toEqual({ command: '/bin/tool', commandArgs: ['a b'], verbatim: false });
    expect(spawnCommand('win32', 'C:\\VS Code\\bin\\code.cmd', ['--wait', 'C:\\Users\\R&D\\a^b "x".ts', 'Yours (%PATH%!)', 'C:\\t\\'])).toEqual({
      command: 'cmd.exe',
      commandArgs: ['/d', '/s', '/c', '""C:\\VS Code\\bin\\code.cmd" "--wait" "C:\\Users\\R&D\\a^b x.ts" "Yours (PATH)" "C:\\t\\\\""'],
      verbatim: true,
    });
  });
});
