import { BrowserWindow, nativeTheme, type BaseWindow } from 'electron';
import type { WindowChrome } from '@shared/windowChrome';
import { sendEventTo } from '../ipc/sendEvent';
import { captionButtons, trafficLightsAt } from './titleBar';

/** What the View menu's Actual Size, Zoom In and Zoom Out do to the page. */
export type PageZoomChange = 'reset' | 'in' | 'out';

/** Half a zoom level a step (about 10%), as Electron's own zoom roles take. */
const ZOOM_LEVEL_STEP = 0.5;

/**
 * Zooms the window's page, and fits every window's controls to its zoom and tells its page (`pageZoomChanged`):
 * Chromium keeps one zoom per origin, and every window's page is the same `file://` one, so all of them zoom together.
 */
export function zoomPage(window: BaseWindow | undefined, change: PageZoomChange, chrome: WindowChrome): void {
  if (!(window instanceof BrowserWindow)) return;
  const { webContents } = window;
  webContents.zoomLevel = change === 'reset' ? 0 : webContents.zoomLevel + (change === 'in' ? ZOOM_LEVEL_STEP : -ZOOM_LEVEL_STEP);
  for (const each of BrowserWindow.getAllWindows()) {
    fitWindowControls(each, chrome);
    sendEventTo(each.webContents, 'pageZoomChanged', { zoom: each.webContents.getZoomFactor() });
  }
}

/**
 * Fits the window's controls to the zoom its page loads at, again on each reload: Chromium gives a page the zoom its
 * origin was left at (it outlives a restart), so a window can open zoomed. The page reads that zoom itself before its
 * first frame (`initialZoom`), and `createMainWindow` fits the controls before it shows the window. The menu's zoom
 * (`zoomPage`) is the only other way the zoom changes: Electron leaves Ctrl+wheel to the app (`zoom-changed`,
 * unhandled) and pinching zooms no page.
 */
export function followPageZoom(window: BrowserWindow, chrome: WindowChrome): void {
  window.webContents.on('dom-ready', () => fitWindowControls(window, chrome));
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
