import { fakeApi } from '../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { createQueryClient, isRefreshable } from '../../app/queryClient';
import { repositoryListingQuery } from './repositoryListing';

describe("a folder of the repository's tree at a changeset", () => {
  it('is read once, in that changeset, and no refresh reads it again', async () => {
    fakeApi.answer('explorer.listRepositoryDirectory', () => []);
    const client = createQueryClient();
    await client.fetchQuery(repositoryListingQuery('/ws', 12, 'src'));

    const query = client.getQueryCache().find({ queryKey: repositoryListingQuery('/ws', 12, 'src').queryKey })!;
    expect(fakeApi.calls()).toEqual([{ method: 'explorer.listRepositoryDirectory', args: ['/ws', 12, 'src'] }]);
    expect(query.isStale()).toBe(false);
    expect(isRefreshable(query)).toBe(false);
  });
});
