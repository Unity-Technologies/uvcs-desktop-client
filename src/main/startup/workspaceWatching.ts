import { webContents, type WebContents } from 'electron';
import type { CmClient } from '../cm/CmClient';
import { sendEventTo } from '../ipc/sendEvent';
import { WorkspaceWatchers } from '../watch/WorkspaceWatchers';
import type { WorkspaceHeaders } from '../workspace/WorkspaceHeaders';

/**
 * Watches the workspaces the windows show: windows on the same workspace share its watcher and its `cm shell`
 * sessions, which go once no window shows it. A change, or the watch breaking, goes to the windows showing its
 * workspace only; a `.plastic` rewrite, by the app or any tool, forgets what was read of the workspace.
 */
export function watchShownWorkspaces(cm: Pick<CmClient, 'release'>, headers: Pick<WorkspaceHeaders, 'forget'>): WorkspaceWatchers {
  return new WorkspaceWatchers({
    changed: (viewers, workspacePath, change) => {
      if (change.metadata) headers.forget(workspacePath);
      for (const target of windowsOf(viewers)) sendEventTo(target, 'workspaceChanged', { workspacePath, ...change });
    },
    broken: (viewers, workspacePath) => {
      for (const target of windowsOf(viewers)) sendEventTo(target, 'workspaceWatchBroken', { workspacePath });
    },
    stopped: (workspacePath) => cm.release(workspacePath),
  });
}

function windowsOf(viewers: number[]): WebContents[] {
  return viewers.map((viewer) => webContents.fromId(viewer)).filter((target) => target !== undefined);
}
