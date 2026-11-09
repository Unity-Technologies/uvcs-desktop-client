import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { Place } from '@shared/domain/place';
import type { Changeset } from '@shared/domain/changeset';
import { otherRepository } from '@shared/domain/repository';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { changesetKey } from './changesetKey';
import { queryClient } from '../../app/queryClient';
import { usePlace, usePlaceRepository } from '../../app/workspace/useWorkspace';

/**
 * `repository` is the one the changeset is in, when it may not be the place's (an item's, under an xlink): it is
 * read there then, and only once the place's repository is known, which tells the two apart.
 */
export function useChangeset(changesetId: number | null, repository?: string) {
  const place = usePlace();
  const placeRepository = usePlaceRepository();
  return useQuery(changesetQuery(queryClient, place, changesetId, { repository, placeRepository }));
}

/** Where a changeset is, as `useChangeset` is asked for it: its repository when maybe not the place's, and the place's once known. */
export interface ChangesetWhere {
  repository?: string;
  placeRepository: string | undefined;
}

/** `useChangeset`'s query, apart from React so a test reads it as a view would. */
export function changesetQuery(client: QueryClient, place: Place, changesetId: number | null, { repository, placeRepository }: ChangesetWhere) {
  const known = !repository || placeRepository !== undefined;
  const other = otherRepository(repository, placeRepository);
  // The place's lists hold its own repository's changesets only.
  const listed = () => (known && !other ? listedChangeset(place, changesetId, client) : undefined);
  return {
    queryKey: changesetKey(place, changesetId, other),
    queryFn: () => api.changesets.get(place, changesetId!, other),
    enabled: changesetId !== null && known,
    // Opened from a list already read (Changesets, the palette): shown at once, asked for only once that list is stale.
    initialData: () => listed()?.changeset,
    initialDataUpdatedAt: () => listed()?.readAt,
  };
}

/**
 * The place's changeset `changesetId` for an action that needs it once clicked (its parent): what `useChangeset` or a
 * list already read, else one read, kept as `useChangeset` keeps it.
 */
export async function readChangeset(place: Place, changesetId: number): Promise<Changeset> {
  return (
    listedChangeset(place, changesetId)?.changeset ??
    queryClient.ensureQueryData({ queryKey: changesetKey(place, changesetId), queryFn: () => api.changesets.get(place, changesetId) })
  );
}


/** The changeset from a list of the place's changesets already read, and when that list was read. */
export function listedChangeset(place: Place, changesetId: number | null, client: QueryClient = queryClient): { changeset: Changeset; readAt: number } | undefined {
  if (changesetId === null) return undefined;
  for (const query of client.getQueryCache().findAll({ queryKey: queryKeys.inPlace(place, 'changesets') })) {
    const changeset = Array.isArray(query.state.data) ? (query.state.data as Changeset[]).find((listed) => listed.id === changesetId) : undefined;
    if (changeset) return { changeset, readAt: query.state.dataUpdatedAt };
  }
  return undefined;
}
