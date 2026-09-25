import { useEffect } from 'react';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { queryClient } from '../queryClient';
import { useSettings } from '../settings/useSettings';
import { useWorkspacePath } from '../workspace/useWorkspace';

/** Refreshes pending changes when files change on disk (if auto refresh is on). */
export function useWorkspaceWatcher(): void {
  const workspacePath = useWorkspacePath();
  const { autoRefresh } = useSettings();

  useEffect(() => {
    void api.workspaces.watch(workspacePath);
  }, [workspacePath]);

  useUvcsEvent('workspaceChanged', (event) => {
    if (!autoRefresh || event.workspacePath !== workspacePath) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.inWorkspace(workspacePath, 'pendingChanges') });
  });
}
