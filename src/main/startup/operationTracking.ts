import { BrowserWindow } from 'electron';
import { currentCaller } from '../ipc/caller';
import { sendEventToCaller } from '../ipc/sendEvent';
import { OperationTracker } from '../operations/OperationTracker';
import type { AppIconProgress } from '../window/AppIconProgress';
import type { WorkspaceWatchers } from '../watch/WorkspaceWatchers';

/**
 * Tracks the long operations: each one's progress goes to the window that started it and to the app's icon, and the
 * watcher of that window's workspace drops what the operation writes, as the renderer refreshes after it anyway.
 */
export function trackOperations(watchers: Pick<WorkspaceWatchers, 'ignoreOwnWrite' | 'workspaceOf'>, icon: AppIconProgress): OperationTracker {
  return new OperationTracker(
    (operationId, progress) => {
      sendEventToCaller('operationProgress', { operationId, progress });
      icon.reported(operationId, progress);
    },
    (operationId, finished, signal) => {
      const caller = currentCaller();
      watchers.ignoreOwnWrite(finished, caller && watchers.workspaceOf(caller.id));
      const window = caller && BrowserWindow.fromWebContents(caller);
      if (window) icon.started(operationId, window.id, finished, signal);
    },
  );
}
