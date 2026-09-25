import { useCallback, useMemo, useRef } from 'react';
import { usePanInertia, type PanInertia } from './usePanInertia';
import { useViewportGlide } from './useViewportGlide';
import { useZoomAnimation } from './useZoomAnimation';
import { clampViewport, zoomAt, type Size, type Viewport } from './viewport';

export interface GraphViewport {
  viewportRef: React.RefObject<Viewport>;
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
  inertia: PanInertia;
}

/**
 * The canvas viewport: every change goes through the bounds (the graph never leaves the screen),
 * zoom steps glide and mouse drags keep some inertia.
 */
export function useGraphViewport(contentSize: () => Size, screenSize: () => Size, onChange: () => void): GraphViewport {
  const viewportRef = useRef<Viewport>({ panX: 0, panY: 0, zoom: 1 });
  const latest = useRef({ contentSize, screenSize, onChange });
  latest.current = { contentSize, screenSize, onChange };

  const apply = useCallback((next: Viewport) => {
    const screen = latest.current.screenSize();
    // Before the first layout there is no screen to keep the graph on.
    const bounded = screen.width === 0 ? next : clampViewport(next, latest.current.contentSize(), screen);
    const current = viewportRef.current;
    if (bounded.panX === current.panX && bounded.panY === current.panY && bounded.zoom === current.zoom) return;
    viewportRef.current = bounded;
    latest.current.onChange();
  }, []);

  const panBy = useCallback(
    (dx: number, dy: number) => {
      const before = viewportRef.current;
      apply({ ...before, panX: before.panX + dx, panY: before.panY + dy });
      return { dx: viewportRef.current.panX - before.panX, dy: viewportRef.current.panY - before.panY };
    },
    [apply],
  );

  const zoomTo = useCallback(
    (screenX: number, screenY: number, zoom: number) => apply(zoomAt(viewportRef.current, zoom / viewportRef.current.zoom, screenX, screenY)),
    [apply],
  );

  const zoomAnimation = useZoomAnimation(zoomTo, () => viewportRef.current.zoom);
  const inertia = usePanInertia(panBy);
  const glide = useViewportGlide(apply, () => viewportRef.current, () => latest.current.screenSize());

  return useMemo<GraphViewport>(() => {
    const stop = (): void => {
      zoomAnimation.stop();
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
        const screen = latest.current.screenSize();
        glide.glideTo(screen.width === 0 ? viewport : clampViewport(viewport, latest.current.contentSize(), screen));
      },
      pinchZoom: (screenX, screenY, factor) => {
        zoomAnimation.stop();
        glide.stop();
        zoomTo(screenX, screenY, viewportRef.current.zoom * factor);
      },
      zoomStep: (screenX, screenY, factor) => {
        inertia.cancel();
        glide.stop();
        zoomAnimation.zoomStep(screenX, screenY, factor);
      },
      keepInBounds: () => apply(viewportRef.current),
    };
  }, [apply, panBy, zoomTo, zoomAnimation, inertia, glide]);
}
