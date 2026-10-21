import type { BrowserWindowConstructorOptions, Point, TitleBarOverlayOptions } from 'electron';
import { TITLE_BAR_HEIGHT, type WindowChrome } from '@shared/windowChrome';

/** The traffic lights' top-left corner at 100% zoom, in window points: centered in the top bar. */
const TRAFFIC_LIGHTS = { x: 16, y: 16 };

/** How far above the top bar's middle the traffic lights' top sits: kept at every zoom, it keeps them centered. */
const TRAFFIC_LIGHTS_ABOVE_MIDDLE = TITLE_BAR_HEIGHT / 2 - TRAFFIC_LIGHTS.y;

/**
 * The top bar's height in window points at a page zoom (View > Zoom In, Zoom Out: `zoomPage`): the page draws it
 * `TITLE_BAR_HEIGHT` CSS pixels tall, and the zoom scales those.
 */
export function topBarHeightAt(zoom: number): number {
  return Math.round(TITLE_BAR_HEIGHT * zoom);
}

/**
 * Where the traffic lights go at a page zoom: as far in from the left as at 100% (the page leaves them the same room
 * in window points: `--window-zoom`), and centered in the top bar, which grows and shrinks with the zoom.
 */
export function trafficLightsAt(zoom: number): Point {
  const y = Math.round((TITLE_BAR_HEIGHT * zoom) / 2 - TRAFFIC_LIGHTS_ABOVE_MIDDLE);
  return { x: TRAFFIC_LIGHTS.x, y: Math.max(0, y) };
}

/**
 * The caption buttons over the top bar, as tall as it at the page's zoom: no background of their own, so the bar's
 * sheen shows through, and symbols in the theme's primary text color (`--text-primary`).
 */
export function captionButtons(dark: boolean, zoom: number): TitleBarOverlayOptions {
  return { color: '#00000000', symbolColor: dark ? '#e6edf3' : '#1f2328', height: topBarHeightAt(zoom) };
}

/**
 * The window options that draw its title bar (`windowChrome`), for a page at 100%: once the page loads, the controls
 * follow its zoom (`followPageZoom`).
 */
export function titleBarOptions(chrome: WindowChrome, dark: boolean): BrowserWindowConstructorOptions {
  if (chrome === 'inset') return { titleBarStyle: 'hiddenInset', trafficLightPosition: trafficLightsAt(1) };
  if (chrome === 'overlay') return { titleBarStyle: 'hidden', titleBarOverlay: captionButtons(dark, 1) };
  return { titleBarStyle: 'default' };
}
