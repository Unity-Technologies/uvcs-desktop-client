import type { QueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { workspaceKey } from '../../api/queryKeys';
import { discardHistory, type DiscardHistory } from '../../features/diff/viewer/discardHistory';
import { queryClient } from '../queryClient';

/** The workspace a window no longer shows, now that it shows `current` (another one, or the home screen); null if none. */
export function workspaceLeft(previous: string | null, current: string | null): string | null {
  return previous !== null && previous !== current ? previous : null;
}

/**
 * Forgets what this window read of a workspace it left. Each window has its own query client, so nothing else reads
 * them: kept, a workspace's immutable results (revisions' texts and images, kept for an hour) would stay in memory
 * long after the window moved on, hundreds of MB after big diffs. Coming back reads the workspace again. The undo
 * history of its discards goes too: each keeps whole files' texts.
 */
export function forgetWorkspace(client: QueryClient, workspacePath: string, discards: DiscardHistory = discardHistory): void {
  client.removeQueries({ queryKey: workspaceKey(workspacePath) });
  discards.forgetWorkspace(workspacePath);
}

/**
 * Forgets the workspace the window leaves (`forgetWorkspace`). In an effect, so the left workspace's views have
 * unmounted, and stopped observing its queries, by the time they go; an effect run again on the same workspace (React's
 * StrictMode) leaves nothing.
 */
export function useForgetLeftWorkspace(workspacePath: string | null): void {
  const shown = useRef(workspacePath);
  useEffect(() => {
    const left = workspaceLeft(shown.current, workspacePath);
    shown.current = workspacePath;
    if (left !== null) forgetWorkspace(queryClient, left);
  }, [workspacePath]);
}
