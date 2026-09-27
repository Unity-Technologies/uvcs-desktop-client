import type { BrowserWindowConstructorOptions, TitleBarOverlayOptions } from 'electron';
import { TITLE_BAR_HEIGHT, type WindowChrome } from '@shared/windowChrome';

/** The traffic lights' top-left corner, centered in the top bar. */
const TRAFFIC_LIGHTS = { x: 16, y: 16 };

/**
 * The caption buttons over the top bar: no background of their own, so the bar's sheen shows through, and symbols
 * in the theme's primary text color (`--text-primary`).
 */
export function captionButtons(dark: boolean): TitleBarOverlayOptions {
  return { color: '#00000000', symbolColor: dark ? '#e6edf3' : '#1f2328', height: TITLE_BAR_HEIGHT };
}

/** The window options that draw its title bar (`windowChrome`). */
export function titleBarOptions(chrome: WindowChrome, dark: boolean): BrowserWindowConstructorOptions {
  if (chrome === 'inset') return { titleBarStyle: 'hiddenInset', trafficLightPosition: TRAFFIC_LIGHTS };
  if (chrome === 'overlay') return { titleBarStyle: 'hidden', titleBarOverlay: captionButtons(dark) };
  return { titleBarStyle: 'default' };
}
