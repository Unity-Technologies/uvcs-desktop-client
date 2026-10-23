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
 * The newest changesets: one query, and one cache entry, shared by the palette and the changeset picker. A heavy read
 * (`SLOW_CHANGING_QUERY`): focus never reads it again, only a minute's staleness once a reader shows. `repository`
 * (`name@server`) reads another repository's than the workspace's, an xlinked one's.
 */
export function recentChangesetsQuery(workspacePath: string, repository?: string) {
  return {
    queryKey: queryKeys.objectList(workspacePath, 'changesets', RECENT_CHANGESETS_FILTER, repository),
    queryFn: () => api.changesets.list(workspacePath, RECENT_CHANGESETS_FILTER, repository),
    ...SLOW_CHANGING_QUERY,
    staleTime: RECENT_CHANGESETS_STALE_TIME,
    gcTime: RECENT_CHANGESETS_CACHE_TIME,
  };
}
