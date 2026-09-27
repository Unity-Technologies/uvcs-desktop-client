import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { CmShellPool } from './CmShellPool';

const fakeCm = fileURLToPath(new URL('./testing/fakeCmShell.mjs', import.meta.url));
let pool: CmShellPool;

afterEach(() => pool.disposeAll());

async function becomesReady(cwd: string): Promise<void> {
  const until = Date.now() + 5000;
  while (!pool.isReady(cwd)) {
    if (Date.now() > until) throw new Error('the sessions never got ready');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('CmShellPool', () => {
  it('is not ready in a directory until its sessions start, and starts them when asked', async () => {
    pool = new CmShellPool(fakeCm);
    expect(pool.isReady(process.cwd())).toBe(false);

    await becomesReady(process.cwd());
    await expect(pool.run(process.cwd(), ['echo', 'at-once'])).resolves.toEqual({ output: 'at-once', exitCode: 0 });
  });

  it('keeps each directory apart', async () => {
    pool = new CmShellPool(fakeCm);
    await becomesReady(process.cwd());

    expect(pool.isReady(fileURLToPath(new URL('.', import.meta.url)))).toBe(false);
  });
});
