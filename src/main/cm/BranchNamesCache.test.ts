import { describe, expect, it } from 'vitest';
import { placeId, repositoryPlace, workspacePlace, type Place } from '@shared/domain/place';
import { BranchNamesCache } from './BranchNamesCache';

const BRANCHES = [1, 2, 3].map((id) => ({ id, name: `/main/b${id}` }));

function setup(branches = BRANCHES, isShown = (_place: Place) => true) {
  /** The reads of every branch's name, by place; `oneReads`, those of one branch, `<place>#<id>`. */
  const reads: string[] = [];
  const oneReads: string[] = [];
  let now = 0;
  const cache = new BranchNamesCache(
    {
      every: async (place) => {
        reads.push(placeId(place));
        return branches;
      },
      one: async (place, id) => {
        oneReads.push(`${placeId(place)}#${id}`);
        return branches.find((branch) => branch.id === id);
      },
    },
    () => now,
    isShown,
  );
  return { cache, reads, oneReads, advance: (ms: number) => (now += ms) };
}

describe('BranchNamesCache', () => {
  it('keeps names as they were, whatever their characters', async () => {
    const { cache } = setup([{ id: 1, name: '/main/tâche-日本-🌿' }]);
    expect(await cache.resolve(workspacePlace('/wk'), [1])).toEqual(new Map([[1, '/main/tâche-日本-🌿']]));
  });

  it('reads every branch name once, when an id is unknown', async () => {
    const { cache, reads } = setup();
    expect(await cache.resolve(workspacePlace('/wk'), [1, 2])).toEqual(new Map([[1, '/main/b1'], [2, '/main/b2']]));
    expect(await cache.resolve(workspacePlace('/wk'), [3])).toEqual(new Map([[3, '/main/b3']]));
    expect(reads).toEqual(['/wk']);
  });

  it("takes an id missing from a recent complete list for a deleted branch, and doesn't read again", async () => {
    const { cache, reads } = setup();
    await cache.resolve(workspacePlace('/wk'), [1, 404]);
    expect(await cache.resolve(workspacePlace('/wk'), [404])).toEqual(new Map());
    expect(reads).toEqual(['/wk']);
  });

  it('shares one read between lookups made meanwhile', async () => {
    const { cache, reads } = setup();
    await Promise.all([cache.resolve(workspacePlace('/wk'), [1, 2]), cache.resolve(workspacePlace('/wk'), [2, 3])]);
    expect(reads).toEqual(['/wk']);
  });

  it('reads names again after a while, so renames show', async () => {
    const { cache, reads, advance } = setup();
    await cache.resolve(workspacePlace('/wk'), [1, 2]);
    advance(11 * 60_000);
    await cache.resolve(workspacePlace('/wk'), [1, 2]);
    expect(reads).toEqual(['/wk', '/wk']);
  });

  it('keeps workspaces apart', async () => {
    const { cache, reads } = setup();
    await cache.resolve(workspacePlace('/a'), [1, 2]);
    await cache.resolve(workspacePlace('/b'), [1, 2]);
    expect(reads).toEqual(['/a', '/b']);
  });

  it('answers from branch lists already read without asking the server', async () => {
    const { cache, reads } = setup();
    cache.remember(workspacePlace('/wk'), [{ id: 7, name: '/main/task' }]);
    expect(await cache.resolve(workspacePlace('/wk'), [7])).toEqual(new Map([[7, '/main/task']]));
    expect(reads).toEqual([]);
  });

  it('trusts a complete list remembered elsewhere (the Branch Explorer) about deleted branches too', async () => {
    const { cache, reads } = setup();
    cache.remember(workspacePlace('/wk'), [{ id: 7, name: '/main/task' }], { complete: true });
    expect(await cache.resolve(workspacePlace('/wk'), [7, 404])).toEqual(new Map([[7, '/main/task']]));
    expect(reads).toEqual([]);
  });

  it("forgets a workspace's names, keeping the other workspaces'", async () => {
    const { cache, reads } = setup();
    await cache.resolve(workspacePlace('/a'), [1, 2]);
    await cache.resolve(workspacePlace('/b'), [1, 2]);

    cache.forget(workspacePlace('/a'));

    await cache.resolve(workspacePlace('/b'), [2, 3]);
    expect(reads).toEqual(['/a', '/b']);
    await cache.resolve(workspacePlace('/a'), [1, 2]);
    expect(reads).toEqual(['/a', '/b', '/a']);
  });

  it('keeps nothing of a read the workspace was forgotten during', async () => {
    const { cache, reads } = setup();
    const lookup = cache.resolve(workspacePlace('/a'), [1, 2]);
    cache.forget(workspacePlace('/a'));
    await lookup;

    await cache.resolve(workspacePlace('/a'), [1, 2]);
    expect(reads).toEqual(['/a', '/a']);
  });

  it('keeps nothing for a workspace no window shows, still answering the lookup that read the names', async () => {
    const { cache, reads } = setup(undefined, () => false);
    cache.remember(workspacePlace('/wk'), [{ id: 7, name: '/main/task' }], { complete: true });

    expect(await cache.resolve(workspacePlace('/wk'), [1, 2])).toEqual(new Map([[1, '/main/b1'], [2, '/main/b2']]));
    expect(await cache.resolve(workspacePlace('/wk'), [7, 8])).toEqual(new Map());
    expect(reads).toEqual(['/wk', '/wk']);
  });

  it('keeps a repository explored without a workspace apart from a workspace on it', async () => {
    const { cache, reads } = setup();
    await cache.resolve(workspacePlace('/wk'), [1, 2]);
    await cache.resolve(repositoryPlace('game@local'), [1, 2]);
    await cache.resolve(repositoryPlace('game@local'), [3]);
    expect(reads).toEqual(['/wk', 'repository:game@local']);
  });

  it("reads one unknown id alone by itself, not every branch's name, and keeps it", async () => {
    const { cache, reads, oneReads } = setup();
    cache.remember(workspacePlace('/wk'), [{ id: 1, name: '/main/b1' }]);

    expect(await cache.resolve(workspacePlace('/wk'), [1, 2])).toEqual(new Map([[1, '/main/b1'], [2, '/main/b2']]));
    expect(await cache.resolve(workspacePlace('/wk'), [2])).toEqual(new Map([[2, '/main/b2']]));
    expect([reads, oneReads]).toEqual([[], ['/wk#2']]);
  });

  it('finds no name for one id of a branch deleted since', async () => {
    const { cache, reads, oneReads } = setup();
    expect(await cache.resolve(workspacePlace('/wk'), [404])).toEqual(new Map());
    expect([reads, oneReads]).toEqual([[], ['/wk#404']]);
  });

  it("waits for every branch's name being read already rather than reading one id apart", async () => {
    const { cache, reads, oneReads } = setup();
    const [, alone] = await Promise.all([cache.resolve(workspacePlace('/wk'), [1, 2]), cache.resolve(workspacePlace('/wk'), [3])]);
    expect(alone).toEqual(new Map([[3, '/main/b3']]));
    expect([reads, oneReads]).toEqual([['/wk'], []]);
  });
});
