import { QueryClient, type Query } from '@tanstack/react-query';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { queryKeys, workspaceKey } from '../api/queryKeys';
import { boundUnusedQueries } from './boundUnusedQueries';
import { workspaceInfoKeyMoved, type WorkspaceInfoPart } from './refresh/headChanges';
import { trackWindowFocus } from './refresh/trackWindowFocus';

trackWindowFocus();

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Coming back to the window refreshes what is on screen if it is older than this; local views are kept
      // fresh by the workspace watcher instead (see useWorkspaceWatcher).
      staleTime: 30_000,
      retry: false,
      refetchOnWindowFocus: true,
    },
  },
});

/**
 * Server lists that hardly change by themselves (every branch, every label, attribute types...), and are heavy on big
 * repositories: kept for five minutes and not re-read on window focus. The operations that change them refresh them
 * (`invalidateWorkspace`), and so does the Refresh button.
 */
export const SLOW_CHANGING_QUERY = { staleTime: 5 * 60_000, refetchOnWindowFocus: false } as const;

/** Marks a query whose result never changes once read (e.g. what a changeset changed), so refreshes skip it. */
export const IMMUTABLE_QUERY = { immutable: true };

/**
 * Meta of a query keyed by a part of the workspace info (the selector, or where the workspace stands): a refresh
 * that moves the workspace doesn't read it once more under the key it is about to leave.
 */
export function keyedByWorkspaceInfo(part: WorkspaceInfoPart) {
  return { workspaceInfoKeyed: part };
}

/** The part of the workspace info a query is keyed by (`keyedByWorkspaceInfo`), if any. */
export function workspaceInfoKeyOf(query: Query): WorkspaceInfoPart | undefined {
  return query.meta?.workspaceInfoKeyed as WorkspaceInfoPart | undefined;
}

/** Whether the workspace info moved from `before` to `after` in the part `query` is keyed by. */
export function isKeyedByMovedInfo(query: Query, before: WorkspaceInfo | undefined, after: WorkspaceInfo | undefined): boolean {
  const part = workspaceInfoKeyOf(query);
  return part !== undefined && before !== undefined && after !== undefined && workspaceInfoKeyMoved(part, before, after);
}

export function isRefreshable(query: Query): boolean {
  return query.meta?.immutable !== true;
}

/** Immutable results kept once off screen: the objects opened last (a changeset's files, a revision's text). */
const MAX_UNUSED_IMMUTABLE = 100;

boundUnusedQueries(queryClient.getQueryCache(), MAX_UNUSED_IMMUTABLE, (query) => !isRefreshable(query));

/**
 * Refreshes every view of a workspace; call it after anything that changes the workspace or its repository.
 * `affected` narrows it to what the change can touch. Views keyed by the workspace info (`keyedByWorkspaceInfo`) wait
 * for it: when a switch, update or checkin gave them another key, they are only marked stale, and read under their
 * new key as they show.
 */
export async function invalidateWorkspace(workspacePath: string, affected: (queryKey: readonly unknown[]) => boolean = () => true): Promise<void> {
  const queryKey = workspaceKey(workspacePath);
  const infoKey = queryKeys.inWorkspace(workspacePath, 'info');
  const refreshed = (query: Query) => isRefreshable(query) && affected(query.queryKey);
  const keyed = (query: Query) => refreshed(query) && workspaceInfoKeyOf(query) !== undefined;
  const isInfo = (query: Query) => query.queryKey[2] === 'info';
  const before = queryClient.getQueryData<WorkspaceInfo>(infoKey);

  const others = queryClient.invalidateQueries({ queryKey, predicate: (query) => refreshed(query) && !keyed(query) && !isInfo(query) });
  await queryClient.invalidateQueries({ queryKey: infoKey, exact: true, predicate: refreshed });
  const after = queryClient.getQueryData<WorkspaceInfo>(infoKey);
  const moved = (query: Query) => isKeyedByMovedInfo(query, before, after);

  await Promise.all([
    others,
    queryClient.invalidateQueries({ queryKey, predicate: (query) => keyed(query) && moved(query), refetchType: 'none' }),
    queryClient.invalidateQueries({ queryKey, predicate: (query) => keyed(query) && !moved(query) }),
  ]);
}
