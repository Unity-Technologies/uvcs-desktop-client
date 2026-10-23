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
  waiting.push(() => !target.isDestroyed() && target.send(EVENT_CHANNEL, name, payload));
}

/**
 * The events waiting for the page to load, sent once Electron stops saying it loads (`did-stop-loading`, after a load
 * that failed too). Not at `did-finish-load`: `isLoading` may still be true then, and an event sent in between would
 * wait for a load that never comes (the first screen's commands, logged before the page, went missing that way).
 */
function sendOnceLoaded(target: WebContents): (() => void)[] {
  const sends: (() => void)[] = [];
  waitingForLoad.set(target, sends);
  target.once('did-stop-loading', () => {
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

/**
 * Sends events to the window whose API call is running now, however long after: what a call starts may be carried on
 * by work another call started (a search joining another window's listing), whose async context names that window.
 */
export function sendEventsToCaller(): <Name extends UvcsEventName>(name: Name, payload: UvcsEvents[Name]) => void {
  const caller = currentCaller();
  return (name, payload) => (caller ? sendEventTo(caller, name, payload) : sendEvent(name, payload));
}
