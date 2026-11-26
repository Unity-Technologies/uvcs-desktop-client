import { queryOptions, useQuery } from '@tanstack/react-query';
import { repositoryKey } from '@shared/domain/repository';
import type { RepositoryGuid } from '@shared/domain/stableIds';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../queryMeta';
import { usePlaceRepository } from './useWorkspace';

// What the app keeps for a repository is kept by its GUID, which a rename never changes (ARCHITECTURE.md "Settings
// survive renames"). Only the main process can tell it (`repositories.guidOf`): free once a listing of the server
// taught it, as the home screen's does, else one listing. Each window reads it once per repository, and what is kept
// for the repository reads as none meanwhile, so nothing waits for it.

/** The GUID of the repository a spec names; null when its server holds none by that name or `cm` prints none. */
export function repositoryGuidQuery(repositorySpec: string) {
  return queryOptions({
    queryKey: queryKeys.repositoryGuid(repositoryKey(repositorySpec)),
    queryFn: () => api.repositories.guidOf(repositorySpec),
    // A GUID never changes; and a name that found none isn't asked again on every focus, or a `cm` that prints no GUID
    // would list the server each time.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    meta: IMMUTABLE_QUERY,
  });
}

/** The repository's GUID; undefined while it's read, and when it can't be (its server out of reach, a `cm` printing none). */
export function useRepositoryGuid(repositorySpec: string | undefined): RepositoryGuid | undefined {
  const { data } = useQuery({ ...repositoryGuidQuery(repositorySpec ?? ''), enabled: repositorySpec !== undefined });
  return data ?? undefined;
}

/** The GUID of the window's place's repository (`usePlaceRepository`), as `useRepositoryGuid` reads it. */
export function usePlaceRepositoryGuid(): RepositoryGuid | undefined {
  return useRepositoryGuid(usePlaceRepository());
}
