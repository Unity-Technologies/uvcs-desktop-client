import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENT_CHANNEL } from '@shared/ipc';
import type { WindowChrome } from '@shared/windowChrome';
import { followPageZoom, zoomPage } from './pageZoom';
import { fakeElectron, type FakeWindow } from './testing/fakeElectron';

vi.mock('electron', async () => (await import('./testing/fakeElectron')).fakeElectron.module);

beforeEach(() => fakeElectron.reset());

/** A window whose controls follow its page's zoom, as `createMainWindow` makes it. */
function followingWindow(chrome: WindowChrome): FakeWindow {
  const window = fakeElectron.newWindow();
  followPageZoom(window as never, chrome);
  return window;
}

const zoomsSent = (window: FakeWindow) => window.webContents.sent.filter(([channel, name]) => channel === EVENT_CHANNEL && name === 'pageZoomChanged').map(([, , payload]) => payload);

describe('zoomPage', () => {
  it('zooms in and out by half a zoom level, and back to 100%', () => {
    const window = followingWindow('inset');

    zoomPage(window as never, 'in', 'inset');
    expect(window.webContents.zoomLevel).toBe(0.5);
    zoomPage(window as never, 'out', 'inset');
    zoomPage(window as never, 'out', 'inset');
    expect(window.webContents.zoomLevel).toBe(-0.5);
    zoomPage(window as never, 'reset', 'inset');
    expect(window.webContents.zoomLevel).toBe(0);
  });

  it('centers the traffic lights in the zoomed top bar and tells the page its zoom, in every window (macOS)', () => {
    const [first, second] = [followingWindow('inset'), followingWindow('inset')];

    zoomPage(first as never, 'out', 'inset');

    const zoom = 1.2 ** -0.5;
    for (const window of [first, second]) {
      expect(window.windowButtonPosition).toEqual({ x: 16, y: 14 });
      expect(zoomsSent(window)).toEqual([{ zoom }]);
    }
  });

  it('makes the caption buttons as tall as the zoomed top bar, in the theme’s colors (Windows)', () => {
    const window = followingWindow('overlay');

    zoomPage(window as never, 'in', 'overlay');

    expect(window.titleBarOverlay).toEqual({ color: '#00000000', symbolColor: '#1f2328', height: 48 });
    expect(window.windowButtonPosition).toBeNull();
  });

  it('only tells the page its zoom where the desktop draws the frame (Linux)', () => {
    const window = followingWindow('native');

    zoomPage(window as never, 'in', 'native');

    expect([window.windowButtonPosition, window.titleBarOverlay]).toEqual([null, null]);
    expect(zoomsSent(window)).toEqual([{ zoom: 1.2 ** 0.5 }]);
  });

  it('does nothing without a window to zoom', () => {
    zoomPage(undefined, 'in', 'inset');
    expect(fakeElectron.newWindow().webContents.zoomLevel).toBe(0);
  });
});

describe('followPageZoom', () => {
  it('fits the controls to the zoom the page opens at, which Chromium keeps for every window', () => {
    const window = followingWindow('inset');
    window.webContents.zoomLevel = 1;

    window.webContents.emit('dom-ready');

    expect(window.windowButtonPosition).toEqual({ x: 16, y: 20 });
    expect(zoomsSent(window)).toEqual([{ zoom: 1.2 }]);
  });
});
