import { BrowserWindow, type WebContents } from 'electron';
import type { UvcsEventName, UvcsEvents } from '@shared/events';
import { EVENT_CHANNEL } from '@shared/ipc';
import { currentCaller } from './caller';

/** Sends an event to every window. */
export function sendEvent<Name extends UvcsEventName>(name: Name, payload: UvcsEvents[Name]): void {
  for (const window of BrowserWindow.getAllWindows()) sendEventTo(window.webContents, name, payload);
}

export function sendEventTo<Name extends UvcsEventName>(target: WebContents, name: Name, payload: UvcsEvents[Name]): void {
  if (!target.isDestroyed()) target.send(EVENT_CHANNEL, name, payload);
}

/** Sends an event to the window whose API call caused it, or to every window when no call did. */
export function sendEventToCaller<Name extends UvcsEventName>(name: Name, payload: UvcsEvents[Name]): void {
  const caller = currentCaller();
  if (caller) sendEventTo(caller, name, payload);
  else sendEvent(name, payload);
}
