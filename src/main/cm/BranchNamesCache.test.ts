import { describe, expect, it } from 'vitest';
import { BranchNamesCache } from './BranchNamesCache';

function setup(branches = [1, 2, 3].map((id) => ({ id, name: `/main/b${id}` }))) {
  const reads: string[] = [];
  let now = 0;
  const cache = new BranchNamesCache(
    async (workspacePath) => {
      reads.push(workspacePath);
      return branches;
    },
    () => now,
  );
  return { cache, reads, advance: (ms: number) => (now += ms) };
}

describe('BranchNamesCache', () => {
  it('keeps names as they were, whatever their characters', async () => {
    const { cache } = setup([{ id: 1, name: '/main/tâche-日本-🌿' }]);
    expect(await cache.resolve('/wk', [1])).toEqual(new Map([[1, '/main/tâche-日本-🌿']]));
  });

  it('reads every branch name once, when an id is unknown', async () => {
    const { cache, reads } = setup();
    expect(await cache.resolve('/wk', [1, 2])).toEqual(new Map([[1, '/main/b1'], [2, '/main/b2']]));
    expect(await cache.resolve('/wk', [3])).toEqual(new Map([[3, '/main/b3']]));
    expect(reads).toEqual(['/wk']);
  });

  it("takes an id missing from a recent complete list for a deleted branch, and doesn't read again", async () => {
    const { cache, reads } = setup();
    await cache.resolve('/wk', [404]);
    expect(await cache.resolve('/wk', [404])).toEqual(new Map());
    expect(reads).toEqual(['/wk']);
  });

  it('shares one read between lookups made meanwhile', async () => {
    const { cache, reads } = setup();
    await Promise.all([cache.resolve('/wk', [1]), cache.resolve('/wk', [2])]);
    expect(reads).toEqual(['/wk']);
  });

  it('reads names again after a while, so renames show', async () => {
    const { cache, reads, advance } = setup();
    await cache.resolve('/wk', [1]);
    advance(11 * 60_000);
    await cache.resolve('/wk', [1]);
    expect(reads).toEqual(['/wk', '/wk']);
  });

  it('keeps workspaces apart', async () => {
    const { cache, reads } = setup();
    await cache.resolve('/a', [1]);
    await cache.resolve('/b', [1]);
    expect(reads).toEqual(['/a', '/b']);
  });

  it('answers from branch lists already read without asking the server', async () => {
    const { cache, reads } = setup();
    cache.remember('/wk', [{ id: 7, name: '/main/task' }]);
    expect(await cache.resolve('/wk', [7])).toEqual(new Map([[7, '/main/task']]));
    expect(reads).toEqual([]);
  });

  it('trusts a complete list remembered elsewhere (the Branch Explorer) about deleted branches too', async () => {
    const { cache, reads } = setup();
    cache.remember('/wk', [{ id: 7, name: '/main/task' }], { complete: true });
    expect(await cache.resolve('/wk', [7, 404])).toEqual(new Map([[7, '/main/task']]));
    expect(reads).toEqual([]);
  });
});
