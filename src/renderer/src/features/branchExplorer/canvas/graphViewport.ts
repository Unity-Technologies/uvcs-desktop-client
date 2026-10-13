import type { FrameClock } from '../../../lib/frameClock';
import { PanInertia } from './panInertia';
import { clampViewport, MAX_ZOOM, MIN_ZOOM, zoomAt, type Size, type Viewport } from './viewport';
import { ViewportGlide } from './viewportGlide';
import { ZoomGlide } from '../../../lib/zoomGlide';

export interface GraphViewport {
  viewportRef: { readonly current: Viewport };
  /** Jumps to a viewport, stopping any glide. */
  jumpTo: (viewport: Viewport) => void;
  /** Glides to a viewport (as close as the bounds allow). */
  glideTo: (viewport: Viewport) => void;
  /** Stops a zoom glide or a drag's inertia where it is: the user took over. */
  stop: () => void;
  /** Pans by a screen delta and returns how far the view actually moved. */
  panBy: (dx: number, dy: number) => { dx: number; dy: number };
  /** Zooms right away around a screen point: a trackpad pinch follows the fingers. */
  pinchZoom: (screenX: number, screenY: number, factor: number) => void;
  /** Glides one zoom step around a screen point: wheel notches, buttons, keys. */
  zoomStep: (screenX: number, screenY: number, factor: number) => void;
  /** Applies the bounds again after the graph or the canvas changed size. */
  keepInBounds: () => void;
  /** Whether a glide is taking the view somewhere, as a reveal does. */
  gliding: () => boolean;
  inertia: PanInertia;
}

/** What the viewport keeps the graph within, and whom it tells when it moves. Read at each change. */
export interface GraphViewportSources {
  contentSize: () => Size;
  screenSize: () => Size;
  onChange: () => void;
}

/**
 * The canvas viewport: every change goes through the bounds (the graph never leaves the screen),
 * zoom steps glide and mouse drags keep some inertia. Whatever the user does stops the motion another started.
 */
export function createGraphViewport(sources: GraphViewportSources, clock: FrameClock): GraphViewport {
  const viewportRef = { current: { panX: 0, panY: 0, zoom: 1 } as Viewport };

  const bounded = (next: Viewport): Viewport => {
    const screen = sources.screenSize();
    // Before the first layout there is no screen to keep the graph on.
    return screen.width === 0 ? next : clampViewport(next, sources.contentSize(), screen);
  };

  const apply = (next: Viewport): void => {
    const within = bounded(next);
    const current = viewportRef.current;
    if (within.panX === current.panX && within.panY === current.panY && within.zoom === current.zoom) return;
    viewportRef.current = within;
    sources.onChange();
  };

  const panBy = (dx: number, dy: number): { dx: number; dy: number } => {
    const before = viewportRef.current;
    apply({ ...before, panX: before.panX + dx, panY: before.panY + dy });
    return { dx: viewportRef.current.panX - before.panX, dy: viewportRef.current.panY - before.panY };
  };

  const zoomTo = (screenX: number, screenY: number, zoom: number): void =>
    apply(zoomAt(viewportRef.current, zoom / viewportRef.current.zoom, screenX, screenY));

  const zoomGlide = new ZoomGlide<{ x: number; y: number }>(({ x, y }, zoom) => zoomTo(x, y, zoom), () => viewportRef.current.zoom, clock, { min: MIN_ZOOM, max: MAX_ZOOM });
  const inertia = new PanInertia(panBy, clock);
  const glide = new ViewportGlide(apply, () => viewportRef.current, () => sources.screenSize(), clock);

  const stop = (): void => {
    zoomGlide.stop();
    inertia.cancel();
    glide.stop();
  };

  return {
    viewportRef,
    panBy,
    inertia,
    stop,
    jumpTo: (viewport) => {
      stop();
      apply(viewport);
    },
    glideTo: (viewport) => {
      stop();
      glide.glideTo(bounded(viewport));
    },
    pinchZoom: (screenX, screenY, factor) => {
      zoomGlide.stop();
      glide.stop();
      zoomTo(screenX, screenY, viewportRef.current.zoom * factor);
    },
    zoomStep: (screenX, screenY, factor) => {
      inertia.cancel();
      glide.stop();
      zoomGlide.zoomStep({ x: screenX, y: screenY }, factor);
    },
    keepInBounds: () => apply(viewportRef.current),
    gliding: () => glide.gliding(),
  };
}
