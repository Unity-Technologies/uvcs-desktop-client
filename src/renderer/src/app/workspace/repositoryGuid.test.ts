import { fakeApi } from '../../testing/fakeWindow';
import { beforeEach, describe, expect, it } from 'vitest';
import { repositoryGuidFor } from '@shared/testing/stableIdsFor';
import { isRefreshable, queryClient } from '../queryClient';
import { repositoryGuidQuery } from './repositoryGuid';

beforeEach(() => queryClient.clear());

/** Whether a refresh reads the GUID of `spec` again, once the main process answered `answer`. */
async function refreshedAfter(spec: string, answer: ReturnType<typeof repositoryGuidFor> | null): Promise<boolean> {
  fakeApi.answer('repositories.guidOf', () => answer);
  const query = repositoryGuidQuery(spec);
  await queryClient.fetchQuery(query);
  return isRefreshable(queryClient.getQueryCache().find({ queryKey: query.queryKey })!);
}

describe('repositoryGuidQuery', () => {
  it('is never refreshed once a GUID is read, as a GUID never changes', async () => {
    expect(await refreshedAfter('game@local', repositoryGuidFor(1))).toBe(false);
  });

  it('is refreshed while its server holds no repository by that name, which may be made since', async () => {
    expect(await refreshedAfter('tools@local', null)).toBe(true);
  });
});
