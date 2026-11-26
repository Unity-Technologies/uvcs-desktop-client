import { queryOptions, useQuery } from '@tanstack/react-query';
import { REPOSITORY_LISTING_FRESH_MS, repositoryKey } from '@shared/domain/repository';
import type { RepositoryGuid } from '@shared/domain/stableIds';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { IMMUTABLE_QUERY } from '../queryMeta';
import { usePlaceRepository } from './useWorkspace';

// What the app keeps for a repository is kept by its GUID, which a rename never changes (ARCHITECTURE.md "Settings
// survive renames"). Only the main process can tell it (`repositories.guidOf`): free once a listing of the server
// taught it, as the home screen's does, else one listing. Each window reads it once per repository, and what is kept
// for the repository reads as none meanwhile, so nothing waits for it.

/**
 * The GUID of the repository a spec names; null when its server holds none by that name, asked again once its listing
 * is a minute old (`REPOSITORY_LISTING_FRESH_MS`), as the repository may have been made since. Every `cm` the app runs
 * (its pinned version or newer: docs/features/cm-runtime.md) prints `{repguid}`.
 */
export function repositoryGuidQuery(repositorySpec: string) {
  return queryOptions({
    queryKey: queryKeys.repositoryGuid(repositoryKey(repositorySpec)),
    queryFn: () => api.repositories.guidOf(repositorySpec),
    // A GUID never changes, and nothing is asked again on focus.
    staleTime: (query) => (query.state.data === null ? REPOSITORY_LISTING_FRESH_MS : Infinity),
    refetchOnWindowFocus: false,
    meta: IMMUTABLE_QUERY,
  });
}

/**
 * The repository's GUID; undefined while it's read, and when it can't be (its server out of reach, no repository by
 * that name). `read` false only takes one read already (by a check-in, another view): what reads it when it's needed.
 */
export function useRepositoryGuid(repositorySpec: string | undefined, { read = true } = {}): RepositoryGuid | undefined {
  return useRepositoryGuidRead(repositorySpec, { read }).guid;
}

/**
 * The repository's GUID as `useRepositoryGuid` reads it, and whether the read ended without one (`unreadable`: its
 * server out of reach, no repository by that name), for what says so instead of waiting.
 */
export function useRepositoryGuidRead(repositorySpec: string | undefined, { read = true } = {}): { guid: RepositoryGuid | undefined; unreadable: boolean } {
  const { data, isError } = useQuery({ ...repositoryGuidQuery(repositorySpec ?? ''), enabled: repositorySpec !== undefined && read });
  return { guid: data ?? undefined, unreadable: isError || data === null };
}

/** The GUID of the window's place's repository (`usePlaceRepository`), as `useRepositoryGuid` reads it. */
export function usePlaceRepositoryGuid(): RepositoryGuid | undefined {
  return useRepositoryGuid(usePlaceRepository());
}
