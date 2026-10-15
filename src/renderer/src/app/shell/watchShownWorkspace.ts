import type { WatchCoverage, WorkspacesApi } from '@shared/api/workspaces';

/**
 * Asks main to watch the workspace a window shows, and hands on how much it watches (`onCoverage`); the function
 * returned stops it, when the window stops showing the workspace. Main answers once the watch has started (on Linux,
 * once every folder is watched): an answer that comes after the stop was for a watch already stopped, which says
 * nothing of the workspace shown now (StrictMode's second mount, a quick switch), so it's dropped.
 */
export function watchShownWorkspace(
  workspacePath: string,
  workspaces: Pick<WorkspacesApi, 'watch' | 'unwatch'>,
  onCoverage: (coverage: WatchCoverage) => void,
): () => void {
  let shown = true;
  void workspaces.watch(workspacePath).then((coverage) => {
    if (shown) onCoverage(coverage);
  });
  return () => {
    shown = false;
    void workspaces.unwatch();
  };
}
