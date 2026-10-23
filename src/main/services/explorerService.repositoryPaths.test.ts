import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** The events sent, each with the window whose call was running when its sender was made (`sendEventsToCaller`). */
const sent = vi.hoisted(() => [] as unknown[][]);
const calling = vi.hoisted(() => ({ window: 'A' }));
vi.mock('../ipc/sendEvent', () => ({
  sendEventsToCaller: () => {
    const window = calling.window;
    return (...args: unknown[]) => void sent.push([window, ...args]);
  },
}));

import { repositoryPlace } from '@shared/domain/place';
import { formatOutput } from '../cm/testing/cmOutput';
import { fakeCmClient, runsUntilCancelled, type CmAnswer } from '../cm/testing/fakeCmClient';
import { RepositoryPathSearch } from '../files/RepositoryPathSearch';
import { SessionFolder } from '../files/SessionFolder';
import { createExplorerService } from './explorerService';
import { serviceContext } from './testing/serviceContext';

const GAME = repositoryPlace('game@local');
const TREE = formatOutput(['dir', '/'], ['dir', '/Assets'], ['txt', '/Assets/Player.cs'], ['txt', '/README.md']);

async function explorer(answer: CmAnswer = TREE) {
  const fake = fakeCmClient({ ls: answer });
  const folder = new SessionFolder({ prefix: 'uvcs-trees-', tempFolder: await mkdtemp(join(tmpdir(), 'explorer-paths-')), pid: 100, isRunning: () => false });
  return { ...fake, service: createExplorerService(serviceContext(fake.cm, { repositoryPaths: new RepositoryPathSearch(fake.cm, folder) })) };
}

beforeEach(() => {
  sent.splice(0);
  calling.window = 'A';
});

describe("finding a repository's files", () => {
  it('resolves the best matches, and tells the window that asked each better set found meanwhile, by its search', async () => {
    const { service } = await explorer();

    expect(await service.findRepositoryPaths(GAME, 12, 'player', 'search-1')).toEqual([{ path: 'Assets/Player.cs', isDirectory: false }]);
    expect(sent).toEqual([['A', 'repositoryPathsFound', { searchId: 'search-1', paths: [{ path: 'Assets/Player.cs', isDirectory: false }], source: 'server' }]]);
  });

  it('stops a search by its id, the tree listing on for the next one, and stops nothing once it is done', async () => {
    const { service } = await explorer(runsUntilCancelled('cancelled'));

    const searching = service.findRepositoryPaths(GAME, 12, 'player', 'search-1');
    await service.stopFindingRepositoryPaths('search-1');
    await service.stopFindingRepositoryPaths('unknown');
    expect(await searching).toEqual([]);
  });

  it("tells each window its own search's results, though the second joined the first's listing", async () => {
    const { service } = await explorer();

    const fromA = service.findRepositoryPaths(GAME, 12, 'player', 'search-a');
    calling.window = 'B';
    const fromB = service.findRepositoryPaths(GAME, 12, 'readme', 'search-b');
    await Promise.all([fromA, fromB]);

    expect(sent.map(([window, , payload]) => [window, (payload as { searchId: string }).searchId])).toEqual([
      ['A', 'search-a'],
      ['B', 'search-b'],
    ]);
  });
});
