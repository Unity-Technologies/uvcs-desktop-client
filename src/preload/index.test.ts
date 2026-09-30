import { afterEach, describe, expect, it, vi } from 'vitest';
import { contextBridge, ipcRenderer } from 'electron';
import type { UvcsBridge } from '@shared/bridge';
import { EVENT_CHANNEL, INVOKE_CHANNEL } from '@shared/ipc';

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
  webUtils: { getPathForFile: vi.fn() },
}));

type EventHandler = (event: unknown, name: string, payload: unknown) => void;

/** Loads the preload script as a window does, and returns what it exposed as `window.uvcs`. */
async function exposedBridge(): Promise<UvcsBridge> {
  vi.resetModules();
  vi.mocked(contextBridge.exposeInMainWorld).mockClear();
  await import('./index');
  const [[key, bridge]] = vi.mocked(contextBridge.exposeInMainWorld).mock.calls as [[string, UvcsBridge]];
  expect(key).toBe('uvcs');
  return bridge;
}

describe('the preload bridge', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('sends every API call over the one invoke channel', async () => {
    const bridge = await exposedBridge();
    const request = { method: 'branches.list', args: ['/wk', {}] };

    await bridge.invoke(request);

    expect(ipcRenderer.invoke).toHaveBeenCalledWith(INVOKE_CHANNEL, request);
  });

  it('hands a listener only the events it subscribed to, until it unsubscribes', async () => {
    const bridge = await exposedBridge();
    const listener = vi.fn();

    const unsubscribe = bridge.on('menuCommand', listener);
    const [[channel, handler]] = vi.mocked(ipcRenderer.on).mock.calls.slice(-1) as unknown as [[string, EventHandler]];
    handler({}, 'menuCommand', { commandId: 'refresh' });
    handler({}, 'commandLogged', { id: 1 });
    unsubscribe();

    expect(channel).toBe(EVENT_CHANNEL);
    expect(listener.mock.calls).toEqual([[{ commandId: 'refresh' }]]);
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith(EVENT_CHANNEL, handler);
  });

  it("tells the renderer the platform, or the one it previews (UVCS_RENDERER_PLATFORM)", async () => {
    expect((await exposedBridge()).platform).toBe(process.platform);

    vi.stubEnv('UVCS_RENDERER_PLATFORM', 'win32');
    expect((await exposedBridge()).platform).toBe('win32');
  });
});
