import { contextBridge, ipcRenderer } from 'electron';
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

  platform: process.platform,
};

contextBridge.exposeInMainWorld('uvcs', bridge);
