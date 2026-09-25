import { Notification } from 'electron';
import { sendEventTo } from '../ipc/sendEvent';
import { focusWindow, type WorkspaceWindows } from './WorkspaceWindows';

/** Shown notifications, referenced until they go away so their click handler survives garbage collection. */
const shown = new Set<Notification>();

/**
 * Someone checked in to the loaded branch while the window was in the background. Clicking brings the window
 * showing the workspace forward and leads to Incoming there.
 */
export function showIncomingNotification(windows: WorkspaceWindows, workspacePath: string, message: string): void {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title: message, silent: true });
  shown.add(notification);
  notification.on('click', () => {
    shown.delete(notification);
    const window = windows.windowShowing(workspacePath);
    if (!window) return windows.focusAny();
    focusWindow(window);
    sendEventTo(window.webContents, 'incomingNotificationClicked', { workspacePath });
  });
  notification.on('close', () => shown.delete(notification));
  notification.show();
}
