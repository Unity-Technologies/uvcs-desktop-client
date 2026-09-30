import { BrowserWindow, type WebContents } from 'electron';
import type { UvcsEventName, UvcsEvents } from '@shared/events';
import { EVENT_CHANNEL } from '@shared/ipc';
import { currentCaller } from './caller';

/** Sends an event to every window. */
export function sendEvent<Name extends UvcsEventName>(name: Name, payload: UvcsEvents[Name]): void {
  for (const window of BrowserWindow.getAllWindows()) sendEventTo(window.webContents, name, payload);
}

/** Events for pages still loading, in the order they were sent. */
const waitingForLoad = new WeakMap<WebContents, (() => void)[]>();

/**
 * Sends an event to a window's page. A page still loading gets it once it has loaded: it has no listeners before, and
 * what the main process does ahead of it (`EarlyCalls`: the commands of its first reads) would never reach its
 * command log.
 */
export function sendEventTo<Name extends UvcsEventName>(target: WebContents, name: Name, payload: UvcsEvents[Name]): void {
  if (target.isDestroyed()) return;
  if (!target.isLoading()) {
    target.send(EVENT_CHANNEL, name, payload);
    return;
  }
  const waiting = waitingForLoad.get(target) ?? sendOnceLoaded(target);
  waiting.push(() => sendEventTo(target, name, payload));
}

/** The events waiting for the page to load, sent then. */
function sendOnceLoaded(target: WebContents): (() => void)[] {
  const sends: (() => void)[] = [];
  waitingForLoad.set(target, sends);
  target.once('did-finish-load', () => {
    waitingForLoad.delete(target);
    sends.forEach((send) => send());
  });
  return sends;
}

/** Sends an event to the window whose API call caused it, or to every window when no call did. */
export function sendEventToCaller<Name extends UvcsEventName>(name: Name, payload: UvcsEvents[Name]): void {
  const caller = currentCaller();
  if (caller) sendEventTo(caller, name, payload);
  else sendEvent(name, payload);
}
