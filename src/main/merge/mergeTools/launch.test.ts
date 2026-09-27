import { describe, expect, it } from 'vitest';
import { launchMergeTool } from './launch';

/** A tool made of a Node script, so the launch is tested the same on every OS. */
const tool = (script: string): [string, string[]] => [process.execPath, ['-e', script]];

describe('launchMergeTool', () => {
  it('is done as soon as a stopped tool exits, even while something it started still holds its output', async () => {
    const stop = new AbortController();
    const started = Date.now();
    const launcher = tool(
      "require('node:child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 5000)'], { stdio: 'inherit' }); setTimeout(() => {}, 5000)",
    );
    const run = launchMergeTool(...launcher, stop.signal);
    setTimeout(() => stop.abort(), 300);
    await expect(run).resolves.toMatchObject({ exitCode: null, errorOutput: '' });
    expect(Date.now() - started).toBeLessThan(3000);
  });

  it('tells how long the tool ran', async () => {
    const run = await launchMergeTool(...tool('setTimeout(() => {}, 200)'), new AbortController().signal);
    expect(run.seconds).toBeGreaterThanOrEqual(0.2);
    expect(run.seconds).toBeLessThan(3);
  });

  it('reports how a tool that ran to the end exited', async () => {
    await expect(launchMergeTool(...tool("console.error('oops'); process.exit(3)"), new AbortController().signal)).resolves.toMatchObject({
      exitCode: 3,
      errorOutput: 'oops',
    });
  });
});
