import { BrowserWindow, type WebContents } from 'electron';
import { currentCaller } from '../ipc/caller';
import { sendEventToCaller } from '../ipc/sendEvent';
import { OperationTracker } from '../operations/OperationTracker';
import type { AppIconProgress } from '../window/AppIconProgress';
import type { WorkspaceWatchers } from '../watch/WorkspaceWatchers';

/** The `BrowserWindow.id` of the window whose page made the call. */
type WindowIdOf = (caller: WebContents) => number | undefined;

const windowOfPage: WindowIdOf = (caller) => BrowserWindow.fromWebContents(caller)?.id;

/**
 * Tracks the long operations: each one's progress goes to the window that started it and to the app's icon, and the
 * watcher of that window's workspace drops what the operation writes, as the renderer refreshes after it anyway.
 */
export function trackOperations(
  watchers: Pick<WorkspaceWatchers, 'ignoreOwnWrite' | 'workspaceOf'>,
  icon: Pick<AppIconProgress, 'started' | 'reported'>,
  windowIdOf: WindowIdOf = windowOfPage,
): OperationTracker {
  return new OperationTracker(
    (operationId, progress) => {
      sendEventToCaller('operationProgress', { operationId, progress });
      icon.reported(operationId, progress);
    },
    (operationId, finished, signal) => {
      const caller = currentCaller();
      watchers.ignoreOwnWrite(finished, caller && watchers.workspaceOf(caller.id));
      const windowId = caller && windowIdOf(caller);
      if (windowId !== undefined) icon.started(operationId, windowId, finished, signal);
    },
  );
}
