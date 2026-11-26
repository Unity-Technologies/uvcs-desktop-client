import { BrowserWindow, nativeTheme, type BaseWindow } from 'electron';
import type { WindowChrome } from '@shared/windowChrome';
import { sendEventTo } from '../ipc/sendEvent';
import type { SettingsStore } from '../settings/SettingsStore';
import { captionButtons, trafficLightsAt } from './titleBar';

/** What the View menu's Actual Size, Zoom In and Zoom Out do to the page. */
export type PageZoomChange = 'reset' | 'in' | 'out';

/** Half a zoom level a step (about 10%), as Electron's own zoom roles take. */
const ZOOM_LEVEL_STEP = 0.5;

/** The zoom factors Chromium can show, 25% to 500%: a zoom edited by hand in the settings is kept within them. */
const ZOOM_FACTOR_RANGE = { min: 0.25, max: 5 };

/**
 * How each window keeps its zoom: as its own, through every page it loads. The app keeps one zoom (`zoomLevel`), which
 * every window opens at (`savedZoomFactor`) and `zoomPage` sets on them all. Not Chromium's default mode, which keys a
 * zoom by the page's whole `file://` address, query included: dropping the query (`openPlaceFromAddress`) would change
 * a window's zoom without telling anyone, leaving the traffic lights and the page at the old one, and a zoom would
 * come back at a launch only to a window opening at the same address.
 */
export const WINDOW_ZOOM_MODE = 'isolated';

/** The zoom factor (1 at 100%) the windows open at: the saved zoom level, 100% when there is none. */
export function savedZoomFactor(settings: Pick<SettingsStore, 'get'>): number {
  const { zoomLevel } = settings.get();
  if (!Number.isFinite(zoomLevel)) return 1;
  return Math.min(ZOOM_FACTOR_RANGE.max, Math.max(ZOOM_FACTOR_RANGE.min, 1.2 ** zoomLevel));
}

/**
 * Zooms every window from the zoom of the one the menu was used in, fits each one's controls to it and tells its page
 * (`pageZoomChanged`), and saves it for the windows that open next and the next launch.
 */
export function zoomPage(window: BaseWindow | undefined, change: PageZoomChange, chrome: WindowChrome, settings: Pick<SettingsStore, 'update'>): void {
  if (!(window instanceof BrowserWindow)) return;
  const current = window.webContents.zoomLevel;
  const level = change === 'reset' ? 0 : current + (change === 'in' ? ZOOM_LEVEL_STEP : -ZOOM_LEVEL_STEP);
  for (const each of BrowserWindow.getAllWindows()) {
    each.webContents.zoomLevel = level;
    showPageZoom(each, chrome);
  }
  // Read back: Chromium keeps the zoom within what it can show (25% to 500%).
  settings.update({ zoomLevel: window.webContents.zoomLevel });
}

/**
 * Fits the window's controls to the zoom its page loads at, and tells the page, again on each reload: the page's
 * address names the zoom the window opened at (`startingZoomIn`), which a reload may find stale. `createMainWindow`
 * also fits the controls before it shows the window. The menu's zoom (`zoomPage`) is the only other way the zoom
 * changes: Electron leaves Ctrl+wheel to the app (`zoom-changed`, unhandled) and pinching zooms no page.
 */
export function followPageZoom(window: BrowserWindow, chrome: WindowChrome): void {
  window.webContents.on('dom-ready', () => showPageZoom(window, chrome));
}

/** Fits the window's controls to its page's zoom, and tells the page (`pageZoomChanged`). */
function showPageZoom(window: BrowserWindow, chrome: WindowChrome): void {
  fitWindowControls(window, chrome);
  sendEventTo(window.webContents, 'pageZoomChanged', { zoom: window.webContents.getZoomFactor() });
}

/** Puts the traffic lights (macOS) or the caption buttons (Windows) back in the top bar, which the page's zoom scales. */
export function fitWindowControls(window: BrowserWindow, chrome: WindowChrome): void {
  if (chrome === 'inset') window.setWindowButtonPosition(trafficLightsAt(window.webContents.getZoomFactor()));
  if (chrome === 'overlay') fitCaptionButtons(window);
}

/** Makes the caption buttons (Windows) as tall as the top bar at the page's zoom, in the theme's colors. */
export function fitCaptionButtons(window: BrowserWindow): void {
  window.setTitleBarOverlay(captionButtons(nativeTheme.shouldUseDarkColors, window.webContents.getZoomFactor()));
}
