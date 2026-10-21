import { afterEach, describe, expect, it, vi } from 'vitest';
import { contextBridge, ipcRenderer, webFrame } from 'electron';
import type { UvcsBridge } from '@shared/bridge';
import { EVENT_CHANNEL, INVOKE_CHANNEL } from '@shared/ipc';

vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn() },
  webUtils: { getPathForFile: vi.fn() },
  webFrame: { getZoomFactor: vi.fn(() => 1) },
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

/** What the preload script listens to the event channel with, from its latest load. */
function eventChannelHandler(): EventHandler {
  const calls = vi.mocked(ipcRenderer.on).mock.calls.filter(([channel]) => channel === EVENT_CHANNEL);
  return calls.at(-1)![1] as unknown as EventHandler;
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
    const dispatch = eventChannelHandler();
    dispatch({}, 'menuCommand', { commandId: 'refresh' });
    dispatch({}, 'commandLogged', { id: 1 });
    unsubscribe();
    dispatch({}, 'menuCommand', { commandId: 'close' });

    expect(listener.mock.calls).toEqual([[{ commandId: 'refresh' }]]);
  });

  // A window subscribes dozens of times: a channel listener each went over Electron's limit of ten (a warning in the
  // console) and had every event checked by every subscription.
  it('listens on the event channel once, however many subscribe', async () => {
    vi.mocked(ipcRenderer.on).mockClear();
    const bridge = await exposedBridge();
    const [first, second, other] = [vi.fn(), vi.fn(), vi.fn()];

    for (let index = 0; index < 20; index++) bridge.on('commandLogged', vi.fn());
    const unsubscribeFirst = bridge.on('menuCommand', first);
    bridge.on('menuCommand', second);
    bridge.on('commandLogged', other);
    unsubscribeFirst();
    eventChannelHandler()({}, 'menuCommand', { commandId: 'refresh' });

    expect(vi.mocked(ipcRenderer.on).mock.calls.map(([channel]) => channel)).toEqual([EVENT_CHANNEL]);
    expect([first.mock.calls, second.mock.calls, other.mock.calls]).toEqual([[], [[{ commandId: 'refresh' }]], []]);
  });

  it('calls a listener subscribed twice once after one of its subscriptions ends', async () => {
    const bridge = await exposedBridge();
    const listener = vi.fn();

    bridge.on('menuCommand', listener);
    const unsubscribe = bridge.on('menuCommand', listener);
    unsubscribe();
    eventChannelHandler()({}, 'menuCommand', { commandId: 'refresh' });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('hands an event to the listeners there were when it came, whatever they subscribe or end meanwhile', async () => {
    const bridge = await exposedBridge();
    const [ended, added] = [vi.fn(), vi.fn()];
    const endsTheOther = vi.fn(() => {
      unsubscribeEnded();
      bridge.on('menuCommand', added);
    });

    bridge.on('menuCommand', endsTheOther);
    const unsubscribeEnded = bridge.on('menuCommand', ended);
    const dispatch = eventChannelHandler();
    dispatch({}, 'menuCommand', { commandId: 'first' });
    dispatch({}, 'menuCommand', { commandId: 'second' });

    expect(endsTheOther).toHaveBeenCalledTimes(2);
    expect(ended.mock.calls).toEqual([[{ commandId: 'first' }]]);
    expect(added.mock.calls).toEqual([[{ commandId: 'second' }]]);
  });

  it("tells the renderer the platform, or the one it previews (UVCS_RENDERER_PLATFORM)", async () => {
    expect((await exposedBridge()).platform).toBe(process.platform);

    vi.stubEnv('UVCS_RENDERER_PLATFORM', 'win32');
    expect((await exposedBridge()).platform).toBe('win32');
  });

  it('tells the renderer the zoom its page starts at, before its first frame', async () => {
    vi.mocked(webFrame.getZoomFactor).mockReturnValueOnce(1.2 ** -2);

    expect((await exposedBridge()).initialZoom).toBe(1.2 ** -2);
  });
});
