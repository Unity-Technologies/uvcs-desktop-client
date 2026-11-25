import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { UvcsBridge } from '@shared/bridge';
import type { UvcsEventName } from '@shared/events';
import { EVENT_CHANNEL, INVOKE_CHANNEL } from '@shared/ipc';

type EventListener = (payload: unknown) => void;

/**
 * The renderer's listeners by event. The event channel has one listener, which hands each event to its own: a channel
 * listener per subscription went over Electron's limit of ten (`MaxListenersExceededWarning`) and had every
 * subscription look at every event.
 */
const listenersByEvent = new Map<string, Set<EventListener>>();

ipcRenderer.on(EVENT_CHANNEL, (_event: unknown, eventName: string, payload: unknown) => {
  const listeners = listenersByEvent.get(eventName);
  // A copy: one subscribed while the event is handed out gets the next one, as with a channel listener of its own.
  if (listeners) for (const listener of [...listeners]) listener(payload);
});

function listen(name: UvcsEventName, listener: EventListener): () => void {
  const listeners = listenersByEvent.get(name) ?? new Set<EventListener>();
  listenersByEvent.set(name, listeners);
  // Its own entry, so the same function subscribed twice is called twice and unsubscribing once leaves the other.
  const entry: EventListener = (payload) => listener(payload);
  listeners.add(entry);
  return () => void listeners.delete(entry);
}

const bridge: UvcsBridge = {
  invoke: (request) => ipcRenderer.invoke(INVOKE_CHANNEL, request),

  on: (name, listener) => listen(name, listener as EventListener),

  // `UVCS_RENDERER_PLATFORM=win32` (or `linux`) previews another OS's shortcuts, copy and chrome from a Mac: the
  // renderer only, the menus and window frame stay the host's.
  platform: process.env.UVCS_RENDERER_PLATFORM || process.platform,

  pathForFile: (file) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld('uvcs', bridge);
