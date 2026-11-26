import { describe, expect, it } from 'vitest';
import type { WorkspaceStatus } from '../cm/workspaceStatus';
import { tellingRepositoryChanges } from './repositoryChanges';
import type { HeaderReaders } from './WorkspaceHeaders';

/** Header readers whose workspace is on each repository in turn (`name@server`), then the last one again. */
function readersOn(...repositories: string[]): HeaderReaders {
  let reads = 0;
  return {
    status: async () => {
      const [repositoryName = '', server = ''] = repositories[Math.min(reads++, repositories.length - 1)]!.split('@');
      return { repositoryName, server } as WorkspaceStatus;
    },
    names: async () => ({ name: 'game', guid: 'g' }),
  };
}

describe('tellingRepositoryChanges', () => {
  it('tells when a workspace is read on another repository than before: a switch made anywhere', async () => {
    const changed: string[] = [];
    const readers = tellingRepositoryChanges(readersOn('game@local', 'game@local', 'tools@local'), (path) => changed.push(path));

    await readers.status('/wk');
    await readers.status('/wk');
    expect(changed).toEqual([]);
    await readers.status('/wk');
    expect(changed).toEqual(['/wk']);
  });

  it("tells nothing on a workspace's first read, nor of another workspace's", async () => {
    const changed: string[] = [];
    const readers = tellingRepositoryChanges(readersOn('game@local', 'tools@local'), (path) => changed.push(path));

    await readers.status('/wk');
    await readers.status('/other');
    expect(changed).toEqual([]);
  });
});
