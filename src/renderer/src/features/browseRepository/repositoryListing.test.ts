import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { RepositoryTreePoint } from '@shared/domain/explorer';
import { workspacePlace } from '@shared/domain/place';
import { createQueryClient, isRefreshable } from '../../app/queryClient';
import { repositoryListingQuery } from './repositoryListing';

async function readOnce(tree: RepositoryTreePoint) {
  fakeApi.answer('explorer.listRepositoryDirectory', () => []);
  const client = createQueryClient();
  await client.fetchQuery(repositoryListingQuery(workspacePlace('/ws'), tree, 'src'));
  return client.getQueryCache().find({ queryKey: repositoryListingQuery(workspacePlace('/ws'), tree, 'src').queryKey })!;
}

describe("a folder of the repository's tree", () => {
  it('at a changeset is read once, in that changeset, and no refresh reads it again', async () => {
    const query = await readOnce({ kind: 'changeset', changeset: 12 });

    expect(fakeApi.calls()).toEqual([{ method: 'explorer.listRepositoryDirectory', args: [workspacePlace('/ws'), { kind: 'changeset', changeset: 12 }, 'src'] }]);
    expect(query.isStale()).toBe(false);
    expect(isRefreshable(query)).toBe(false);
  });

  it("at a branch is read again by a refresh: the branch's head moves as it gets changesets", async () => {
    const query = await readOnce({ kind: 'branch', branch: '/main' });

    expect(fakeApi.calls()).toEqual([{ method: 'explorer.listRepositoryDirectory', args: [workspacePlace('/ws'), { kind: 'branch', branch: '/main' }, 'src'] }]);
    expect(isRefreshable(query)).toBe(true);
  });

  it('is kept apart for a changeset and a branch', () => {
    const atChangeset = repositoryListingQuery(workspacePlace('/ws'), { kind: 'changeset', changeset: 12 }, 'src').queryKey;
    const atBranch = repositoryListingQuery(workspacePlace('/ws'), { kind: 'branch', branch: '/main' }, 'src').queryKey;

    expect(atChangeset).not.toEqual(atBranch);
  });
});
