import { useEffect, useRef, useState } from 'react';
import type { WatchCoverage } from '@shared/api/workspaces';
import { api } from '../../api/client';
import { queryKeys } from '../../api/queryKeys';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { queryClient } from '../queryClient';
import { refreshQueries } from '../refresh/refreshQueries';
import { isAffectedByFileChanges, LOCAL_AREAS } from '../refresh/refreshScopes';
import { useSettings } from '../settings/useSettings';
import { useWorkspacePath } from '../workspace/useWorkspace';
import { notePartialWatch } from './watchNotes';
import { HeldChanges, inWorkspace, localQueryDefaults, refreshForChange } from './workspaceChangeRefresh';

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
  const coverage = useWatchCoverage(workspacePath);
  useCatchUpWhenAutoRefreshResumes(workspacePath, autoRefresh);
  useLocalQueryDefaults(workspacePath, autoRefresh, coverage);
  useRefreshOnWorkspaceChanges(workspacePath, autoRefresh);
}

/** Asks main to watch the workspace while it shows; how much it watches ('partial' until it answers). */
function useWatchCoverage(workspacePath: string): WatchCoverage {
  const [coverage, setCoverage] = useState<WatchCoverage>('partial');
  useEffect(() => {
    void api.workspaces.watch(workspacePath).then((watched) => {
      setCoverage(watched);
      if (watched === 'partial') notePartialWatch(workspacePath);
    });
    return () => void api.workspaces.unwatch();
  }, [workspacePath]);
  return coverage;
}

/** Edits made while automatic refresh was off went unnoticed: catch up once when it's back on. */
function useCatchUpWhenAutoRefreshResumes(workspacePath: string, autoRefresh: boolean): void {
  const autoRefreshed = useRef(autoRefresh);
  useEffect(() => {
    if (autoRefresh && !autoRefreshed.current) void refreshQueries(inWorkspace(workspacePath, isAffectedByFileChanges));
    autoRefreshed.current = autoRefresh;
  }, [workspacePath, autoRefresh]);
}

/** Local views skip the refresh on window focus while the watcher sees every change (`localQueryDefaults`). */
function useLocalQueryDefaults(workspacePath: string, autoRefresh: boolean, coverage: WatchCoverage): void {
  useEffect(() => {
    for (const area of LOCAL_AREAS) {
      queryClient.setQueryDefaults(queryKeys.inWorkspace(workspacePath, area), localQueryDefaults(area, autoRefresh, coverage));
    }
  }, [workspacePath, autoRefresh, coverage]);
}

/**
 * Refreshes what each change the watcher reports makes stale. A hidden window (minimized, covered, on another
 * desktop) refreshes once, when it shows again, for all the changes meanwhile (`HeldChanges`).
 */
function useRefreshOnWorkspaceChanges(workspacePath: string, autoRefresh: boolean): void {
  const held = useRef(new HeldChanges());
  useUvcsEvent('workspaceChanged', ({ workspacePath: changedPath, ...change }) => {
    if (changedPath !== workspacePath) return;
    if (document.visibilityState === 'visible') void refreshForChange(workspacePath, change, autoRefresh);
    else held.current.hold(workspacePath, change);
  });
  useEffect(() => {
    const refreshHeld = () => {
      if (document.visibilityState !== 'visible') return;
      const change = held.current.take(workspacePath);
      if (change) void refreshForChange(workspacePath, change, autoRefresh);
    };
    document.addEventListener('visibilitychange', refreshHeld);
    return () => document.removeEventListener('visibilitychange', refreshHeld);
  }, [workspacePath, autoRefresh]);
}
