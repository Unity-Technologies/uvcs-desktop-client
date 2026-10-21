import { BrowserWindow, nativeTheme, type BaseWindow } from 'electron';
import type { WindowChrome } from '@shared/windowChrome';
import { sendEventTo } from '../ipc/sendEvent';
import { captionButtons, trafficLightsAt } from './titleBar';

/** What the View menu's Actual Size, Zoom In and Zoom Out do to the page. */
export type PageZoomChange = 'reset' | 'in' | 'out';

/** Half a zoom level a step (about 10%), as Electron's own zoom roles take. */
const ZOOM_LEVEL_STEP = 0.5;

/**
 * Zooms the window's page, and fits every window's controls to its zoom: Chromium keeps one zoom per origin, and
 * every window's page is the same `file://` one, so all of them zoom together.
 */
export function zoomPage(window: BaseWindow | undefined, change: PageZoomChange, chrome: WindowChrome): void {
  if (!(window instanceof BrowserWindow)) return;
  const { webContents } = window;
  webContents.zoomLevel = change === 'reset' ? 0 : webContents.zoomLevel + (change === 'in' ? ZOOM_LEVEL_STEP : -ZOOM_LEVEL_STEP);
  for (const each of BrowserWindow.getAllWindows()) fitControlsToZoom(each, chrome);
}

/**
 * Keeps the window's controls fitted to its page's zoom from the moment the page loads: Chromium gives a page the
 * zoom its origin was left at, so a window can open zoomed. The menu's zoom (`zoomPage`) is the only other way it
 * changes: Electron leaves Ctrl+wheel to the app (`zoom-changed`, unhandled) and pinching zooms no page.
 */
export function followPageZoom(window: BrowserWindow, chrome: WindowChrome): void {
  window.webContents.on('dom-ready', () => fitControlsToZoom(window, chrome));
}

/**
 * Puts the traffic lights (macOS) or the caption buttons (Windows) back in the top bar, which the zoom scales, and
 * tells the page its zoom (`pageZoomChanged`) for it to leave the controls the same room in window points.
 */
function fitControlsToZoom(window: BrowserWindow, chrome: WindowChrome): void {
  if (window.isDestroyed()) return;
  const zoom = window.webContents.getZoomFactor();
  if (chrome === 'inset') window.setWindowButtonPosition(trafficLightsAt(zoom));
  if (chrome === 'overlay') window.setTitleBarOverlay(captionButtons(nativeTheme.shouldUseDarkColors, zoom));
  sendEventTo(window.webContents, 'pageZoomChanged', { zoom });
}
