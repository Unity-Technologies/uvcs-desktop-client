import { QueryClient, type Query } from '@tanstack/react-query';
import { workspaceKey } from '../api/queryKeys';
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

export function isRefreshable(query: Query): boolean {
  return query.meta?.immutable !== true;
}

/**
 * Refreshes every view of a workspace; call it after anything that changes the workspace or its repository.
 * `affected` narrows it to what the change can touch.
 */
export function invalidateWorkspace(workspacePath: string, affected: (queryKey: readonly unknown[]) => boolean = () => true): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: workspaceKey(workspacePath), predicate: (query) => isRefreshable(query) && affected(query.queryKey) });
}
