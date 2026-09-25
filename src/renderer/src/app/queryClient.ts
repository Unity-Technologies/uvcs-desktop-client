import { QueryClient } from '@tanstack/react-query';
import { workspaceKey } from '../api/queryKeys';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: false,
      refetchOnWindowFocus: true,
    },
  },
});

/** Refreshes every view of a workspace; call it after anything that changes the workspace or its repository. */
export function invalidateWorkspace(workspacePath: string): Promise<void> {
  return queryClient.invalidateQueries({ queryKey: workspaceKey(workspacePath) });
}
