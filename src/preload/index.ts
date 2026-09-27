import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { UvcsBridge } from '@shared/bridge';
import { EVENT_CHANNEL, INVOKE_CHANNEL } from '@shared/ipc';

const bridge: UvcsBridge = {
  invoke: (request) => ipcRenderer.invoke(INVOKE_CHANNEL, request),

  on(name, listener) {
    const handler = (_event: unknown, eventName: string, payload: unknown): void => {
      if (eventName === name) listener(payload as Parameters<typeof listener>[0]);
    };
    ipcRenderer.on(EVENT_CHANNEL, handler);
    return () => ipcRenderer.removeListener(EVENT_CHANNEL, handler);
  },

  // `UVCS_RENDERER_PLATFORM=win32` (or `linux`) previews another OS's shortcuts, copy and chrome from a Mac: the
  // renderer only, the menus and window frame stay the host's.
  platform: process.env.UVCS_RENDERER_PLATFORM || process.platform,

  pathForFile: (file) => webUtils.getPathForFile(file),
};

contextBridge.exposeInMainWorld('uvcs', bridge);
