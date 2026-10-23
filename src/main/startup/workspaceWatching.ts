import { webContents, type WebContents } from 'electron';
import { workspacePlace } from '@shared/domain/place';
import type { BranchNamesCache } from '../cm/BranchNamesCache';
import type { CmClient } from '../cm/CmClient';
import { sendEventTo } from '../ipc/sendEvent';
import { WorkspaceWatchers, type CreateWatcher, type WatchersListener } from '../watch/WorkspaceWatchers';
import type { WorkspaceHeaders } from '../workspace/WorkspaceHeaders';

/** What a workspace no window shows anymore lets go of. */
interface ShownWorkspaceState {
  cm: Pick<CmClient, 'release'>;
  headers: Pick<WorkspaceHeaders, 'forget'>;
  branchNames: Pick<BranchNamesCache, 'forget'>;
}

/**
 * Watches the workspaces the windows show: windows on the same workspace share its watcher, its `cm shell` sessions
 * and its branch names, which go once no window shows it. A change, or the watch breaking, goes to the windows showing
 * its workspace only; a `.plastic` rewrite, by the app or any tool, forgets what was read of the workspace.
 */
export function watchShownWorkspaces(
  { cm, headers, branchNames }: ShownWorkspaceState,
  createWatcher?: CreateWatcher,
): WorkspaceWatchers {
  const listener: WatchersListener = {
    changed: (viewers, workspacePath, change) => {
      if (change.metadata) headers.forget(workspacePath);
      for (const target of windowsOf(viewers)) sendEventTo(target, 'workspaceChanged', { workspacePath, ...change });
    },
    broken: (viewers, workspacePath) => {
      for (const target of windowsOf(viewers)) sendEventTo(target, 'workspaceWatchBroken', { workspacePath });
    },
    stopped: (workspacePath) => {
      cm.release(workspacePath);
      branchNames.forget(workspacePlace(workspacePath));
    },
  };
  return new WorkspaceWatchers(listener, createWatcher);
}

function windowsOf(viewers: number[]): WebContents[] {
  return viewers.map((viewer) => webContents.fromId(viewer)).filter((target) => target !== undefined);
}

/** Whether some window shows the workspace: what a window lets go as it leaves it isn't kept again after. */
export function isShown(watchers: Pick<WorkspaceWatchers, 'coverageOf'>, workspacePath: string): boolean {
  return watchers.coverageOf(workspacePath) !== undefined;
}
