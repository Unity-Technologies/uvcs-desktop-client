import type { Query } from '@tanstack/react-query';
import type { WatchCoverage } from '@shared/api/workspaces';
import type { WorkspaceInfo } from '@shared/domain/workspace';
import { mergeWorkspaceChanges, type WorkspaceChange } from '@shared/domain/workspaceChange';
import { queryKeys, workspaceKey } from '../../api/queryKeys';
import { isKeyedByMovedInfo, isRefreshable, queryClient } from '../queryClient';
import { loadedChangesetChanged } from '../refresh/headChanges';
import { refreshQueries } from '../refresh/refreshQueries';
import {
  isAffectedByFileChangesIn,
  isAffectedByLoadedChangeset,
  isAffectedByMovedPaths,
  isAffectedByWorkspaceState,
  type LOCAL_AREAS,
} from '../refresh/refreshScopes';

type QueryKey = readonly unknown[];

/**
 * How a local view (`LOCAL_AREAS`) is kept fresh: while the watcher sees every change and reports it (auto refresh
 * on), window focus doesn't re-read it; `.plastic` rewrites refresh the workspace info even without auto refresh, so
 * views mounting don't need to read it again.
 */
export function localQueryDefaults(area: (typeof LOCAL_AREAS)[number], autoRefresh: boolean, coverage: WatchCoverage) {
  const watched = autoRefresh && coverage === 'full';
  return { refetchOnWindowFocus: !watched, staleTime: area === 'info' && coverage === 'full' ? Infinity : undefined };
}

/** The queries of one workspace that `affected` picks, as refresh filters. */
export function inWorkspace(workspacePath: string, affected: (key: QueryKey) => boolean) {
  return {
    queryKey: workspaceKey(workspacePath),
    predicate: ({ queryKey }: { queryKey: QueryKey }) => affected(queryKey),
  };
}

/**
 * What a change the watcher saw makes stale. `.plastic` rewrites are rare, discrete events, so they refresh even
 * without auto refresh, which guards against streams of file edits. The paths are cheap: re-read only if something
 * shows them, now or later.
 */
export function affectedByChange(change: WorkspaceChange, autoRefresh: boolean): (key: QueryKey) => boolean {
  const fileChanges = isAffectedByFileChangesIn(change.folders);
  return (key) =>
    (change.metadata && isAffectedByWorkspaceState(key)) ||
    (change.content && autoRefresh && fileChanges(key)) ||
    (change.pathsChanged && isAffectedByMovedPaths(key));
}

/**
 * Refreshes what a change made stale; when a `.plastic` rewrite moved the loaded changeset or branch, every view of
 * the workspace too. Resolves once the refreshes are done.
 */
export async function refreshForChange(workspacePath: string, change: WorkspaceChange, autoRefresh: boolean): Promise<void> {
  const affected = affectedByChange(change, autoRefresh);
  const infoKey = queryKeys.inWorkspace(workspacePath, 'info');
  const before = queryClient.getQueryData<WorkspaceInfo>(infoKey);
  await refreshQueries(inWorkspace(workspacePath, affected));
  const after = queryClient.getQueryData<WorkspaceInfo>(infoKey);
  if (change.metadata && before && after && loadedChangesetChanged(before, after)) {
    const rest = (query: Query) => isAffectedByLoadedChangeset(query.queryKey) && !affected(query.queryKey);
    // Views keyed by what moved are read under their new key as they show, not once more under the old one.
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: workspaceKey(workspacePath),
        predicate: (query) => rest(query) && isRefreshable(query) && isKeyedByMovedInfo(query, before, after),
        refetchType: 'none',
      }),
      refreshQueries({ queryKey: workspaceKey(workspacePath), predicate: (query) => rest(query) && !isKeyedByMovedInfo(query, before, after) }),
    ]);
  }
}

/**
 * The changes a hidden window keeps for when it shows again, as one: agents writing in several workspaces would
 * otherwise keep every window re-reading its changes.
 */
export class HeldChanges {
  private held: { workspacePath: string; change: WorkspaceChange } | null = null;

  hold(workspacePath: string, change: WorkspaceChange): void {
    const before = this.held?.workspacePath === workspacePath ? this.held.change : null;
    this.held = { workspacePath, change: before ? mergeWorkspaceChanges(before, change) : change };
  }

  /** What was held for `workspacePath`, forgetting it; changes held for another workspace are dropped. */
  take(workspacePath: string): WorkspaceChange | null {
    const held = this.held;
    this.held = null;
    return held?.workspacePath === workspacePath ? held.change : null;
  }
}
