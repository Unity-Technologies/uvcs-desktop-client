import type { Place } from '@shared/domain/place';
import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { SLOW_CHANGING_QUERY } from '../../app/queryClient';

/**
 * How many of the newest changesets the palette and the changeset picker read: one `cm find ... limit`, never the
 * whole repository (~280k changesets on big ones). Older changesets are still reachable by number (`1234` or `cs:1234`).
 */
export const RECENT_CHANGESETS = 2000;
/** New changesets come by the minute. */
const RECENT_CHANGESETS_STALE_TIME = 60_000;
/** Kept between palette or picker openings, so reopening one never starts from scratch. */
const RECENT_CHANGESETS_CACHE_TIME = 30 * 60_000;

const RECENT_CHANGESETS_FILTER: QueryFilter = { limit: RECENT_CHANGESETS };

/**
 * How many of the newest changesets a comment's suggestions read when the palette's list isn't cached: a `cs:` answers
 * in under a second on a repository of 280,000 (one `cm find … limit 50`). A number past them is looked up, and words
 * are searched in them all ("Search all changesets").
 */
export const SUGGESTED_CHANGESETS = 50;

const SUGGESTED_CHANGESETS_FILTER: QueryFilter = { limit: SUGGESTED_CHANGESETS };

/** The few newest changesets a comment's suggestions read (`SUGGESTED_CHANGESETS`), kept as the palette's list is. */
export function suggestedChangesetsQuery(place: Place) {
  return {
    queryKey: queryKeys.inPlace(place, 'changesets', SUGGESTED_CHANGESETS_FILTER),
    queryFn: () => api.changesets.list(place, SUGGESTED_CHANGESETS_FILTER),
    ...SLOW_CHANGING_QUERY,
    staleTime: RECENT_CHANGESETS_STALE_TIME,
    gcTime: RECENT_CHANGESETS_CACHE_TIME,
  };
}

/**
 * The newest changesets: one query, and one cache entry, shared by the palette and the changeset picker. A heavy read
 * (`SLOW_CHANGING_QUERY`): focus never reads it again, only a minute's staleness once a reader shows.
 */
export function recentChangesetsQuery(place: Place) {
  return {
    queryKey: queryKeys.inPlace(place, 'changesets', RECENT_CHANGESETS_FILTER),
    queryFn: () => api.changesets.list(place, RECENT_CHANGESETS_FILTER),
    ...SLOW_CHANGING_QUERY,
    staleTime: RECENT_CHANGESETS_STALE_TIME,
    gcTime: RECENT_CHANGESETS_CACHE_TIME,
  };
}
