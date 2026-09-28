import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';

/** Read again when the switcher reopens after this long; forgotten as soon after it closes. */
const GLANCE_LIFETIME_MS = 15_000;

/**
 * What another workspace of the same repository is on and how many pending changes it has. One local `cm status`
 * per workspace, only while the switcher shows it (and `enabled`), and reused for a few seconds.
 */
export function useWorkspaceGlance(workspacePath: string, enabled: boolean) {
  return useQuery({
    queryKey: ['workspaceGlance', workspacePath],
    queryFn: () => api.workspaces.glance(workspacePath),
    enabled,
    staleTime: GLANCE_LIFETIME_MS,
    gcTime: GLANCE_LIFETIME_MS,
    refetchOnWindowFocus: false,
  }).data;
}
