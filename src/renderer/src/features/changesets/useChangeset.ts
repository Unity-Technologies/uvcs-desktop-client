import { matchQuery, useQuery, type QueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import type { Place } from '@shared/domain/place';
import type { Changeset } from '@shared/domain/changeset';
import { otherRepository } from '@shared/domain/repository';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { changesetKey } from './changesetKey';
import { queryClient } from '../../app/queryClient';
import { usePlace, usePlaceRepository } from '../../app/workspace/useWorkspace';

/** What a view shows of a changeset: none while it's read, or when it can't be. */
export interface ShownChangeset {
  data: Changeset | undefined;
  isError: boolean;
}

/**
 * The place's changeset `changesetId`. One a list on screen holds (a branch's changesets, Changesets) shows from it and
 * follows it, read again as that list is (`changesetOnScreen`): no read of its own, even while the list is stale and
 * being read again. Any other is read alone (`changesetQuery`).
 *
 * `repository` is the one the changeset is in, when it may not be the place's (an item's, under an xlink): it is
 * read there then, and only once the place's repository is known, which tells the two apart.
 */
export function useChangeset(changesetId: number | null, repository?: string): ShownChangeset {
  const place = usePlace();
  const where: ChangesetWhere = { repository, placeRepository: usePlaceRepository() };
  const listedId = inPlaceLists(where) ? changesetId : null;
  const subscribe = useCallback((changed: () => void) => onListsChange(queryClient, place, changed), [place]);
  const onScreen = useSyncExternalStore(subscribe, () => changesetOnScreen(queryClient, place, listedId));
  const read = useQuery(changesetQuery(queryClient, place, changesetId, where));
  return onScreen ? { data: onScreen, isError: false } : { data: read.data, isError: read.isError };
}

/** Where a changeset is, as `useChangeset` is asked for it: its repository when maybe not the place's, and the place's once known. */
export interface ChangesetWhere {
  repository?: string;
  placeRepository: string | undefined;
}

/** Whether the place's lists may hold it: they hold the place's own repository's changesets only, once that is known. */
function inPlaceLists({ repository, placeRepository }: ChangesetWhere): boolean {
  return !repository || (placeRepository !== undefined && otherRepository(repository, placeRepository) === undefined);
}

/**
 * `useChangeset`'s own read, apart from React so a test reads it as a view would: none for one a list on screen holds
 * (`changesetOnScreen`). Opened from a list no longer on screen (the palette's, a view left), it shows from it at once
 * and is read alone once that list is stale: nothing else would read it again.
 */
export function changesetQuery(client: QueryClient, place: Place, changesetId: number | null, where: ChangesetWhere) {
  const known = !where.repository || where.placeRepository !== undefined;
  const other = otherRepository(where.repository, where.placeRepository);
  const inLists = inPlaceLists(where);
  const listed = () => (inLists ? listedChangeset(place, changesetId, client) : undefined);
  return {
    queryKey: changesetKey(place, changesetId, other),
    queryFn: () => api.changesets.get(place, changesetId!, other),
    enabled: changesetId !== null && known && !(inLists && changesetOnScreen(client, place, changesetId)),
    initialData: () => listed()?.changeset,
    initialDataUpdatedAt: () => listed()?.readAt,
  };
}

/**
 * The changeset from a list of the place's changesets a view shows: that view keeps the list fresh (a focus once
 * stale, the operations that change changesets), so the changeset read alone would be a second command for the same
 * row. The list's own object, the same while the list is.
 */
export function changesetOnScreen(client: QueryClient, place: Place, changesetId: number | null): Changeset | undefined {
  if (changesetId === null) return undefined;
  for (const query of placeLists(client, place)) {
    if (query.getObserversCount() === 0 || !Array.isArray(query.state.data)) continue;
    const changeset = (query.state.data as Changeset[]).find((listed) => listed.id === changesetId);
    if (changeset) return changeset;
  }
  return undefined;
}

/** Calls `changed` when a list of the place's changesets is read, shown or left; returns what stops it. */
function onListsChange(client: QueryClient, place: Place, changed: () => void): () => void {
  const lists = { queryKey: queryKeys.inPlace(place, 'changesets') };
  return client.getQueryCache().subscribe((event) => {
    if (matchQuery(lists, event.query)) changed();
  });
}

function placeLists(client: QueryClient, place: Place) {
  return client.getQueryCache().findAll({ queryKey: queryKeys.inPlace(place, 'changesets') });
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
  for (const query of placeLists(client, place)) {
    const changeset = Array.isArray(query.state.data) ? (query.state.data as Changeset[]).find((listed) => listed.id === changesetId) : undefined;
    if (changeset) return { changeset, readAt: query.state.dataUpdatedAt };
  }
  return undefined;
}
