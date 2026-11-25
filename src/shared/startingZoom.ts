/**
 * A window names its zoom in its page's address, so the page leaves the traffic lights their room from its first frame
 * (`exposePageZoom`). Reading it from the preload (`webFrame.getZoomFactor`) can't: as a page loads, the zoom the window
 * opens at may not have reached it yet. The main process tells the page the zoom again as it loads (`followPageZoom`),
 * which corrects a stale address: a reload, after the page dropped its query (`openPlaceFromAddress`).
 */
const ZOOM_PARAMETER = 'zoom';

/** The page address's query naming the zoom factor (1 at 100%) the window opens at. */
export function startingZoomQuery(zoomFactor: number): Record<string, string> {
  return { [ZOOM_PARAMETER]: String(zoomFactor) };
}

/** The zoom factor a page address's query (`location.search`) names; 1 when it names none. */
export function startingZoomIn(search: string): number {
  const zoom = Number(new URLSearchParams(search).get(ZOOM_PARAMETER) || Number.NaN);
  return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
}
