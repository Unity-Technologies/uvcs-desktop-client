/**
 * Keeps `--window-zoom` on the document at the page's zoom (`pageZoomChanged`), for the styles to leave the window's
 * own controls, which the zoom doesn't scale, the same room in window points (the top bar's traffic lights). Called
 * once, as the page starts; until the main process tells it, the styles take 1.
 */
export function exposePageZoom(): void {
  window.uvcs.on('pageZoomChanged', ({ zoom }) => document.documentElement.style.setProperty('--window-zoom', String(zoom)));
}
