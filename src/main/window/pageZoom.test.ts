import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVENT_CHANNEL } from '@shared/ipc';
import type { WindowChrome } from '@shared/windowChrome';
import type { SettingsStore } from '../settings/SettingsStore';
import { memorySettings } from '../settings/testing/memorySettings';
import { followPageZoom, savedZoomFactor, zoomPage as zoomPageSaving } from './pageZoom';
import { fakeElectron, type FakeWindow } from './testing/fakeElectron';

vi.mock('electron', async () => (await import('./testing/fakeElectron')).fakeElectron.module);

let settings: SettingsStore;

beforeEach(() => {
  fakeElectron.reset();
  settings = memorySettings();
});

/** `zoomPage`, saving the zoom in this test's settings. */
const zoomPage = (window: FakeWindow | undefined, change: Parameters<typeof zoomPageSaving>[1], chrome: WindowChrome) =>
  zoomPageSaving(window as never, change, chrome, settings);

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

    zoomPage(window, 'in', 'inset');
    expect(window.webContents.zoomLevel).toBe(0.5);
    zoomPage(window, 'out', 'inset');
    zoomPage(window, 'out', 'inset');
    expect(window.webContents.zoomLevel).toBe(-0.5);
    zoomPage(window, 'reset', 'inset');
    expect(window.webContents.zoomLevel).toBe(0);
  });

  it('centers the traffic lights in the zoomed top bar and tells the page its zoom, in every window (macOS)', () => {
    const [first, second] = [followingWindow('inset'), followingWindow('inset')];

    zoomPage(first, 'out', 'inset');

    const zoom = 1.2 ** -0.5;
    for (const window of [first, second]) {
      expect(window.windowButtonPosition).toEqual({ x: 16, y: 17 });
      expect(zoomsSent(window)).toEqual([{ zoom }]);
    }
  });

  it('makes the caption buttons as tall as the zoomed top bar, in the theme’s colors (Windows)', () => {
    const window = followingWindow('overlay');

    zoomPage(window, 'in', 'overlay');

    expect(window.titleBarOverlay).toEqual({ color: '#00000000', symbolColor: '#1f2328', height: 57 });
    expect(window.windowButtonPosition).toBeNull();
  });

  it('only tells the page its zoom where the desktop draws the frame (Linux)', () => {
    const window = followingWindow('native');

    zoomPage(window, 'in', 'native');

    expect([window.windowButtonPosition, window.titleBarOverlay]).toEqual([null, null]);
    expect(zoomsSent(window)).toEqual([{ zoom: 1.2 ** 0.5 }]);
  });

  // Each window keeps a zoom of its own (`isolated`), so the app's one zoom is set on every window, page windows too.
  it('zooms every window together, from the one it was chosen in', () => {
    const [first, second] = [followingWindow('inset'), followingWindow('inset')];

    zoomPage(first, 'in', 'inset');
    zoomPage(second, 'in', 'inset');

    expect([first.webContents.zoomLevel, second.webContents.zoomLevel]).toEqual([1, 1]);
  });

  it('saves the zoom, for the windows that open next and the next launch', () => {
    const window = followingWindow('inset');

    zoomPage(window, 'out', 'inset');
    zoomPage(window, 'out', 'inset');

    expect(settings.get().zoomLevel).toBe(-1);
    expect(savedZoomFactor(settings)).toBe(1.2 ** -1);
  });

  it('does nothing without a window to zoom', () => {
    zoomPage(undefined, 'in', 'inset');
    expect([fakeElectron.newWindow().webContents.zoomLevel, settings.get().zoomLevel]).toEqual([0, undefined]);
  });
});

describe('savedZoomFactor', () => {
  it('is 100% until the user zooms, and with a settings file from before the zoom was saved', () => {
    expect(savedZoomFactor(memorySettings())).toBe(1);
    expect(savedZoomFactor(memorySettings({ zoomLevel: Number.NaN }))).toBe(1);
  });

  it('keeps a zoom edited by hand within what Chromium shows, 25% to 500%', () => {
    expect(savedZoomFactor(memorySettings({ zoomLevel: 50 }))).toBe(5);
    expect(savedZoomFactor(memorySettings({ zoomLevel: -50 }))).toBe(0.25);
  });
});

describe('followPageZoom', () => {
  // The page's own first guess (`startingZoomIn`) may be stale, after a reload say: the window's zoom is the truth.
  it('fits the controls to the zoom the page loads at, and tells the page', () => {
    const window = followingWindow('inset');
    window.webContents.zoomLevel = 1;

    window.webContents.emit('dom-ready');

    expect(window.windowButtonPosition).toEqual({ x: 16, y: 24 });
    expect(zoomsSent(window)).toEqual([{ zoom: 1.2 }]);
  });
});
