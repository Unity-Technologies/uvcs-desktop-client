import { useEffect, useState } from 'react';
import type { WatchCoverage } from '@shared/api/workspaces';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import type { WorkspaceChange } from '@shared/events';
import { api } from '../../api/client';
import { queryKeys, workspaceKey } from '../../api/queryKeys';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { queryClient } from '../queryClient';
import { loadedChangesetChanged } from '../refresh/headChanges';
import { refreshQueries } from '../refresh/refreshQueries';
import {
  isAffectedByFileChanges,
  isAffectedByLoadedChangeset,
  isAffectedByMovedPaths,
  isAffectedByWorkspaceState,
  LOCAL_AREAS,
} from '../refresh/refreshScopes';
import { useSettings } from '../settings/useSettings';
import { useWorkspacePath } from '../workspace/useWorkspace';

/**
 * Keeps the workspace views in step with the disk. The main process watches the workspace and reports coalesced
 * changes (its own operations excluded: they refresh everything when done):
 * - file edits refresh the pending changes and the files view (if auto refresh is on);
 * - `.plastic` rewrites (a checkin, update, switch, undo... from any tool) refresh the workspace info, and every
 *   view when the loaded changeset or branch moved.
 * While the watcher sees every change, local views skip the refresh on window focus.
 */
export function useWorkspaceWatcher(): void {
  const workspacePath = useWorkspacePath();
  const { autoRefresh } = useSettings();
  const [coverage, setCoverage] = useState<WatchCoverage>('partial');

  useEffect(() => {
    void api.workspaces.watch(workspacePath).then(setCoverage);
  }, [workspacePath]);

  useEffect(() => {
    const watched = autoRefresh && coverage === 'full';
    for (const area of LOCAL_AREAS) queryClient.setQueryDefaults(queryKeys.inWorkspace(workspacePath, area), { refetchOnWindowFocus: !watched });
  }, [workspacePath, autoRefresh, coverage]);

  useUvcsEvent('workspaceChanged', (event) => {
    if (event.workspacePath === workspacePath) void refreshForChange(workspacePath, event, autoRefresh);
  });
}

async function refreshForChange(workspacePath: string, change: WorkspaceChange, autoRefresh: boolean): Promise<void> {
  const inWorkspace = (affected: (key: readonly unknown[]) => boolean) => ({
    queryKey: workspaceKey(workspacePath),
    predicate: ({ queryKey }: { queryKey: readonly unknown[] }) => affected(queryKey),
  });
  // `.plastic` rewrites are rare, discrete events, so they refresh even without auto refresh, which guards
  // against streams of file edits. The paths are cheap: re-read only if something shows them, now or later.
  const affected = (key: readonly unknown[]) =>
    (change.metadata && isAffectedByWorkspaceState(key)) ||
    (change.content && autoRefresh && isAffectedByFileChanges(key)) ||
    (change.pathsChanged && isAffectedByMovedPaths(key));

  const infoKey = queryKeys.inWorkspace(workspacePath, 'info');
  const before = queryClient.getQueryData<WorkspaceInfo>(infoKey);
  await refreshQueries(inWorkspace(affected));
  const after = queryClient.getQueryData<WorkspaceInfo>(infoKey);
  if (change.metadata && before && after && loadedChangesetChanged(before, after)) {
    void refreshQueries(inWorkspace((key) => isAffectedByLoadedChangeset(key) && !affected(key)));
  }
}
