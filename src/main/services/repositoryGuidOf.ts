import { repositorySpecParts } from '@shared/domain/repository';
import type { RepositoryGuid } from '@shared/domain/stableIds';
import type { ServiceContext } from './ServiceContext';

type RepositoryGuidSources = Pick<ServiceContext, 'repositoryGuids' | 'settings' | 'issueTrackers' | 'diffReviews'>;

/**
 * The GUID of the repository a spec names, the one way from a spec to it (ARCHITECTURE.md "Settings survive renames"):
 * from what a listing taught (`RepositoryGuids`), free when the home screen listed the server, else one listing of it.
 * What was kept for the repository by its spec before moves under its GUID then (`keepByGuid`), before the GUID is
 * answered, so nothing reads by it before it holds them. Undefined when the server holds no such repository; rejects
 * when it can't be listed.
 */
export async function repositoryGuidOf(sources: RepositoryGuidSources, repositorySpec: string): Promise<RepositoryGuid | undefined> {
  const parts = repositorySpecParts(repositorySpec);
  const guid = parts && (await sources.repositoryGuids.guidOf(parts.server, parts.name));
  if (guid) await keepByGuid(sources, repositorySpec, guid);
  return guid;
}

/**
 * What the app kept for the repository by its spec, before it kept it by its GUID, moves under its GUID: its settings,
 * recent comments, issue tracker and review marks. Nothing is written when nothing was kept by the spec.
 */
async function keepByGuid({ settings, issueTrackers, diffReviews }: RepositoryGuidSources, repositorySpec: string, guid: RepositoryGuid): Promise<void> {
  settings.keepRepositoryByGuid(repositorySpec, guid);
  issueTrackers.keepRepositoryByGuid(repositorySpec, guid);
  await diffReviews.keepRepositoryByGuid(repositorySpec, guid);
}
