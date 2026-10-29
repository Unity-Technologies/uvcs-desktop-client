import { BrowserWindow, type WebContents } from 'electron';
import { currentCaller } from '../ipc/caller';
import { sendEventToCaller } from '../ipc/sendEvent';
import { OperationTracker } from '../operations/OperationTracker';
import type { AppIconProgress } from '../window/AppIconProgress';
import type { WindowWrites } from '../window/WindowWrites';
import type { WorkspaceWatchers } from '../watch/WorkspaceWatchers';

/** The `BrowserWindow.id` of the window whose page made the call. */
type WindowIdOf = (caller: WebContents) => number | undefined;

const windowOfPage: WindowIdOf = (caller) => BrowserWindow.fromWebContents(caller)?.id;

/**
 * Tracks the long operations: each one's progress goes to the window that started it and to the app's icon, the
 * watcher of that window's workspace drops what the operation writes, as the renderer refreshes after it anyway, and
 * the window holds its close back until it finishes (`windowWrites`, `ClosingWithWrites`).
 */
export function trackOperations(
  watchers: Pick<WorkspaceWatchers, 'ignoreOwnWrite' | 'workspaceOf'>,
  icon: Pick<AppIconProgress, 'started' | 'reported'>,
  windowWrites: Pick<WindowWrites, 'started'>,
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
      if (windowId === undefined) return;
      icon.started(operationId, windowId, finished, signal);
      windowWrites.started(windowId, finished);
    },
  );
}
