import type { RepositoryGuid } from '@shared/domain/stableIds';
import { queryClient } from '../queryClient';
import { repositoryGuidQuery } from './repositoryGuid';
import { repositoryNotFound } from './repositoryNotFound';

/**
 * The GUID a change the user makes for the repository is written under: the one read already, else read now. Rejects
 * with a message to show when it can't be read, so the change is said to be unsaved, never lost without a word.
 */
export async function repositoryGuidToWrite(repositorySpec: string): Promise<RepositoryGuid> {
  const guid = await queryClient.fetchQuery(repositoryGuidQuery(repositorySpec));
  if (!guid) throw new Error(repositoryNotFound(repositorySpec));
  return guid;
}
