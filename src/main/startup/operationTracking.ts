import { currentCaller } from '../ipc/caller';
import { sendEventToCaller } from '../ipc/sendEvent';
import { OperationTracker } from '../operations/OperationTracker';
import type { WorkspaceWatchers } from '../watch/WorkspaceWatchers';

/**
 * Tracks the long operations: each one's progress goes to the window that started it, and the watcher of that window's
 * workspace drops what the operation writes, as the renderer refreshes after it anyway.
 */
export function trackOperations(watchers: Pick<WorkspaceWatchers, 'ignoreOwnWrite' | 'workspaceOf'>): OperationTracker {
  return new OperationTracker(
    (operationId, progress) => sendEventToCaller('operationProgress', { operationId, progress }),
    (finished) => {
      const caller = currentCaller();
      watchers.ignoreOwnWrite(finished, caller && watchers.workspaceOf(caller.id));
    },
  );
}
