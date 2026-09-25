import { BrowserWindow } from 'electron';
import type { UvcsEventName, UvcsEvents } from '@shared/events';
import { EVENT_CHANNEL } from '@shared/ipc';

export function sendEvent<Name extends UvcsEventName>(name: Name, payload: UvcsEvents[Name]): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(EVENT_CHANNEL, name, payload);
  }
}
