import { describe, expect, it } from 'vitest';
import { launchMergeTool } from './launch';

describe.skipIf(process.platform === 'win32')('launchMergeTool', () => {
  it('is done as soon as a stopped tool exits, even while something it started still holds its output', async () => {
    const stop = new AbortController();
    const started = Date.now();
    const run = launchMergeTool('/bin/sh', ['-c', 'sleep 5; true'], stop.signal);
    setTimeout(() => stop.abort(), 100);
    await expect(run).resolves.toEqual({ exitCode: null, errorOutput: '' });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('reports how a tool that ran to the end exited', async () => {
    await expect(launchMergeTool('/bin/sh', ['-c', 'echo oops >&2; exit 3'], new AbortController().signal)).resolves.toEqual({ exitCode: 3, errorOutput: 'oops' });
  });
});
