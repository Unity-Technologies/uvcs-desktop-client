/** Where `--window-zoom` is set: the document's root element's style, unless a test passes its own. */
type StyleTarget = Pick<CSSStyleDeclaration, 'setProperty'>;

/**
 * Keeps `--window-zoom` on the document at the page's zoom, for the styles to leave the window's own controls, which
 * the zoom doesn't scale, the same room in window points (the top bar's traffic lights). Called once, as the page
 * starts and before its first frame: it sets the zoom the page starts at (`initialZoom`), then each change
 * (`pageZoomChanged`).
 */
export function exposePageZoom(style: StyleTarget = document.documentElement.style): void {
  const setZoom = (zoom: number): void => style.setProperty('--window-zoom', String(zoom));
  setZoom(window.uvcs.initialZoom);
  window.uvcs.on('pageZoomChanged', ({ zoom }) => setZoom(zoom));
}
