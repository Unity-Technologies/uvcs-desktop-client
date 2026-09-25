import { Notification } from 'electron';
import { sendEvent } from '../ipc/sendEvent';
import { focusMainWindow } from './focusMainWindow';

/** Shown notifications, referenced until they go away so their click handler survives garbage collection. */
const shown = new Set<Notification>();

/** Someone checked in to the loaded branch while the window was in the background. Clicking leads to Incoming. */
export function showIncomingNotification(workspacePath: string, message: string): void {
  if (!Notification.isSupported()) return;
  const notification = new Notification({ title: message, silent: true });
  shown.add(notification);
  notification.on('click', () => {
    shown.delete(notification);
    focusMainWindow();
    sendEvent('incomingNotificationClicked', { workspacePath });
  });
  notification.on('close', () => shown.delete(notification));
  notification.show();
}
