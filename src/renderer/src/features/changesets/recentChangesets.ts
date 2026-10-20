import type { QueryFilter } from '@shared/domain/query';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';

/**
 * How many of the newest changesets the palette and the changeset picker read: one `cm find ... limit`, never the
 * whole repository (~280k changesets on big ones). Older changesets are still reachable by number (`1234` or `cs:1234`).
 */
const RECENT_CHANGESETS = 2000;
/** New changesets come by the minute. */
const RECENT_CHANGESETS_STALE_TIME = 60_000;

const RECENT_CHANGESETS_FILTER: QueryFilter = { limit: RECENT_CHANGESETS };

/** The newest changesets: one query, and one cache entry, shared by the palette and the changeset picker. */
export function recentChangesetsQuery(workspacePath: string) {
  return {
    queryKey: queryKeys.inWorkspace(workspacePath, 'changesets', RECENT_CHANGESETS_FILTER),
    queryFn: () => api.changesets.list(workspacePath, RECENT_CHANGESETS_FILTER),
    staleTime: RECENT_CHANGESETS_STALE_TIME,
  };
}
