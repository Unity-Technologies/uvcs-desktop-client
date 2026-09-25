import { describe, expect, it } from 'vitest';
import { BranchNamesCache } from './BranchNamesCache';

function setup() {
  const lookups: number[][] = [];
  let now = 0;
  const cache = new BranchNamesCache(
    async (_workspacePath, ids) => {
      lookups.push(ids);
      return new Map(ids.filter((id) => id !== 404).map((id) => [id, `/main/b${id}`]));
    },
    () => now,
  );
  return { cache, lookups, advance: (ms: number) => (now += ms) };
}

describe('BranchNamesCache', () => {
  it('asks the server only for the ids it has not resolved lately', async () => {
    const { cache, lookups } = setup();
    await cache.resolve('/wk', [1, 2]);
    const names = await cache.resolve('/wk', [2, 3, 3]);

    expect(lookups).toEqual([[1, 2], [3]]);
    expect(names).toEqual(new Map([[2, '/main/b2'], [3, '/main/b3']]));
  });

  it('remembers ids that resolve to nothing, e.g. deleted branches', async () => {
    const { cache, lookups } = setup();
    await cache.resolve('/wk', [404]);
    expect(await cache.resolve('/wk', [404])).toEqual(new Map());
    expect(lookups).toEqual([[404]]);
  });

  it('reads names again after a while, so renames show', async () => {
    const { cache, lookups, advance } = setup();
    await cache.resolve('/wk', [1]);
    advance(11 * 60_000);
    await cache.resolve('/wk', [1]);
    expect(lookups).toEqual([[1], [1]]);
  });

  it('keeps workspaces apart', async () => {
    const { cache, lookups } = setup();
    await cache.resolve('/a', [1]);
    await cache.resolve('/b', [1]);
    expect(lookups).toEqual([[1], [1]]);
  });
});
