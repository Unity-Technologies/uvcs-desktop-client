import type { Query, QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { workspaceKey } from '../../api/queryKeys';
import { isRefreshable, queryClient } from '../queryClient';

/** The workspace a window no longer shows, now that it shows `current` (another one, or the home screen); null if none. */
export function workspaceLeft(previous: string | null, current: string | null): string | null {
  return previous !== null && previous !== current ? previous : null;
}

/**
 * Forgets the big part of what this window read of a workspace it left, once nothing shows it: its immutable results
 * (revisions' texts, images and models, what changesets changed), kept an hour otherwise, and every content its diffs
 * read (`CONTENT_AREAS`), the workspace's own files too (a pending change's side: up to 100 MB and a parsed model),
 * which a return reads again anyway. Each window has its own query client, so nothing else reads them. Its lists and
 * its info are light and stay until their usual `gcTime`, so going home and back within minutes reads nothing from
 * the server again. The query defaults set for the workspace (`setQueryDefaults`, `useWorkspaceWatcher`) stay too: a
 * few entries, set again as it opens.
 */
export function forgetWorkspace(client: QueryClient, workspacePath: string): void {
  client.removeQueries({ queryKey: workspaceKey(workspacePath), predicate: isBigAndUnused });
}

/** The areas of a workspace's queries (`queryKeys.inWorkspace(path, area, …)`) holding contents, whatever their source. */
const CONTENT_AREAS: ReadonlySet<unknown> = new Set(['content', 'contentBytes', 'diffContents']);

const isBigAndUnused = (query: Query): boolean =>
  query.getObserversCount() === 0 && (!isRefreshable(query) || CONTENT_AREAS.has(query.queryKey[2]));

/**
 * Forgets the workspace the window leaves (`forgetWorkspace`). In an effect, so the left workspace's views have
 * unmounted, and stopped observing its queries, by the time they go; an effect run again on the same workspace
 * (React's StrictMode) leaves nothing.
 */
export function useForgetLeftWorkspace(workspacePath: string | null): void {
  const shown = useRef(workspacePath);
  useEffect(() => {
    const left = workspaceLeft(shown.current, workspacePath);
    shown.current = workspacePath;
    if (left !== null) forgetWorkspace(queryClient, left);
  }, [workspacePath]);
}
