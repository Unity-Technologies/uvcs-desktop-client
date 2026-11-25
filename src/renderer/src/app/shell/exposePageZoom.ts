import { startingZoomIn } from '@shared/startingZoom';

/** Where `--window-zoom` is set: the document's root element's style, unless a test passes its own. */
type StyleTarget = Pick<CSSStyleDeclaration, 'setProperty'>;

/**
 * Keeps `--window-zoom` on the document at the page's zoom, for the styles to leave the window's own controls, which
 * the zoom doesn't scale, the same room in window points (the top bar's traffic lights). Called once, as the page
 * starts and before its first frame: it sets the zoom the window names in the page's address (`startingZoomIn`), then
 * each change (`pageZoomChanged`), the first as the page loads.
 */
export function exposePageZoom(search: string = location.search, style: StyleTarget = document.documentElement.style): void {
  const setZoom = (zoom: number): void => style.setProperty('--window-zoom', String(zoom));
  setZoom(startingZoomIn(search));
  window.uvcs.on('pageZoomChanged', ({ zoom }) => setZoom(zoom));
}
