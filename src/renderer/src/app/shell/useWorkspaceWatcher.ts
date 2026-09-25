import { useEffect } from 'react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { workspacePathsKey } from '../../features/files/useWorkspacePaths';
import { queryClient } from '../queryClient';
import { useSettings } from '../settings/useSettings';
import { useWorkspacePath } from '../workspace/useWorkspace';

/** Refreshes pending changes when files change on disk (if auto refresh is on), and the "go to file" paths when items come or go. */
export function useWorkspaceWatcher(): void {
  const workspacePath = useWorkspacePath();
  const { autoRefresh } = useSettings();

  useEffect(() => {
    void api.workspaces.watch(workspacePath);
  }, [workspacePath]);

  useUvcsEvent('workspaceChanged', (event) => {
    if (event.workspacePath !== workspacePath) return;
    // Cheap: the paths are re-read only if something shows them, now or the next time.
    if (event.pathsChanged) void queryClient.invalidateQueries({ queryKey: workspacePathsKey(workspacePath) });
    if (!autoRefresh) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.inWorkspace(workspacePath, 'pendingChanges') });
  });
}
