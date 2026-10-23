import type { Query, QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { samePlace, type Place } from '@shared/domain/place';
import { placeKey } from '../../api/queryKeys';
import { isRefreshable, queryClient } from '../queryClient';

/** The place a window no longer shows, now that it shows `current` (another one, or the home screen); null if none. */
export function placeLeft(previous: Place | null, current: Place | null): Place | null {
  return previous !== null && (current === null || !samePlace(previous, current)) ? previous : null;
}

/**
 * Forgets the big part of what this window read of a place it left (a workspace, or a repository explored without
 * one), once nothing shows it: its immutable results
 * (revisions' texts, images and models, what changesets changed), kept an hour otherwise, and every content its diffs
 * read (`CONTENT_AREAS`), the workspace's own files too (a pending change's side: up to 100 MB and a parsed model),
 * which a return reads again anyway. Each window has its own query client, so nothing else reads them. Its lists and
 * its info are light and stay until their usual `gcTime`, so going home and back within minutes reads nothing from
 * the server again. The query defaults set for the workspace (`setQueryDefaults`, `useWorkspaceWatcher`) stay too: a
 * few entries, set again as it opens.
 */
export function forgetPlace(client: QueryClient, place: Place): void {
  client.removeQueries({ queryKey: placeKey(place), predicate: isBigAndUnused });
}

/** The areas of a place's queries (`queryKeys.inPlace(place, area, …)`) holding contents, whatever their source. */
const CONTENT_AREAS: ReadonlySet<unknown> = new Set(['content', 'contentBytes', 'diffContents']);

const isBigAndUnused = (query: Query): boolean =>
  query.getObserversCount() === 0 && (!isRefreshable(query) || CONTENT_AREAS.has(query.queryKey[2]));

/**
 * Forgets the place the window leaves (`forgetPlace`). In an effect, so the left place's views have unmounted, and
 * stopped observing its queries, by the time they go; an effect run again on the same place (React's StrictMode)
 * leaves nothing.
 */
export function useForgetLeftPlace(place: Place | null): void {
  const shown = useRef(place);
  useEffect(() => {
    const left = placeLeft(shown.current, place);
    shown.current = place;
    if (left !== null) forgetPlace(queryClient, left);
  }, [place]);
}
