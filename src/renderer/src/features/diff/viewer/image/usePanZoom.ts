// The image viewer's one pan and zoom, shared by every mode, so switching modes keeps the exact framing.
//
//   wheel, two-finger scroll     pan
//   pinch, ⌘ or Ctrl + wheel     zoom at the pointer
//   drag (left or middle)        pan
//   double click                 fit ⇄ 100%, into the click
//   buttons and keys             zoom in, out, to fit, to 100%
//
// What the controls ask for glides (a CSS transition on the world, `animated`); what the hand does (wheel, pinch,
// drag) follows at once, as animation under the finger reads as lag. The geometry is in `viewTransform`.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Size } from './composedFrame';
import { followDrag, isDragButton, isOnStageControl } from './pointerDrag';
import {
  clampPan,
  clampZoom,
  doubleClickZoomsIn,
  fitZoom,
  fittedTransform,
  pannedBy,
  rectTransform,
  wheelZoomScale,
  ZOOM_STEP,
  zoomAroundPoint,
  type Point,
  type ViewTransform,
} from './viewTransform';

export interface PanZoom {
  /** Applied as `translate(x, y) scale(scale)`. */
  transform: ViewTransform;
  /** The viewport's size on screen, once measured: the checkerboard stays within it however deep the zoom. */
  viewport: Size | null;
  /** A zoom the controls asked for is gliding (the world's CSS transition). */
  animated: boolean;
  /** The view fits the image, and fits it again as the pane resizes. */
  fitted: boolean;
  /**
   * The ref of every viewport showing the world (side by side binds two): wires the gestures and measures it; React
   * 19's ref cleanup lets go when the mode unmounts.
   */
  bindViewport: (element: HTMLElement | null) => undefined | (() => void);
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  zoomToActualSize: () => void;
  /** Glides to frame `rect` (in image pixels): stepping to a changed region. */
  zoomToRect: (rect: Point & Size) => void;
}

/** How a new transform shows: gliding or at once, and whether it's the fitted view. */
interface Move {
  animated: boolean;
  fitted: boolean;
}

const BY_HAND: Move = { animated: false, fitted: false };

/**
 * `imageSize` is the composed frame both revisions share, null until they decode. Every new image starts fitted, never
 * zoomed past 100%, as the UVCS viewer does.
 */
export function usePanZoom(imageSize: Size | null): PanZoom {
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const [animated, setAnimated] = useState(false);
  const [fitted, setFitted] = useState(true);
  const [viewport, setViewport] = useState<Size | null>(null);

  // The bound viewports. Two at once are layout twins (side by side's halves), so either one measures the view.
  const viewports = useRef(new Set<HTMLElement>());
  // A drag owns the gesture: wheel events meanwhile are a tilt wheel's nudges while its button is held, not panning.
  const dragging = useRef(false);
  // What the gesture handlers read without being bound again at every pan: the viewport measured at once (the state
  // follows a render later), the image and the transform.
  const latest = useRef({ viewport: null as Size | null, image: imageSize, transform, fitted });
  latest.current.image = imageSize;
  latest.current.transform = transform;
  latest.current.fitted = fitted;

  /** The viewport and image sizes, once both are known. */
  const sizes = useCallback((): { viewport: Size; image: Size } | null => {
    const { viewport, image } = latest.current;
    return viewport && image ? { viewport, image } : null;
  }, []);

  const move = useCallback(
    (next: (transform: ViewTransform, viewport: Size, image: Size) => ViewTransform, how: Move): void => {
      const known = sizes();
      if (!known) return;
      setAnimated(how.animated);
      setFitted(how.fitted);
      setTransform((current) => next(current, known.viewport, known.image));
    },
    [sizes],
  );

  const measure = useCallback((element: HTMLElement): void => {
    const size = { width: element.clientWidth, height: element.clientHeight };
    latest.current.viewport = size;
    setViewport(size);
  }, []);

  /** After the viewport or the image changed shape: a fitted view fits again, any other stays within the edges. */
  const reconcile = useCallback((): void => {
    const fittedView = latest.current.fitted;
    move((current, viewport, image) => (fittedView ? fittedTransform(viewport, image) : clampPan(current, viewport, image)), { animated: false, fitted: fittedView });
  }, [move]);

  // Another image (another file): fitted again, as the previous file's deep zoom would show arbitrary pixels.
  useEffect(() => {
    setFitted(true);
    setAnimated(false);
    const known = sizes();
    if (known) setTransform(fittedTransform(known.viewport, known.image));
  }, [imageSize, sizes]);

  /** Glides to `scale` around `anchor` (the viewport's center unless given). */
  const glideTo = useCallback(
    (scale: number, fit: boolean, anchor?: Point): void =>
      move((current, viewport, image) => zoomAroundPoint(current, scale, anchor ?? { x: viewport.width / 2, y: viewport.height / 2 }, viewport, image), {
        animated: true,
        fitted: fit,
      }),
    [move],
  );

  const zoomIn = useCallback(() => glideTo(clampZoom(latest.current.transform.scale * ZOOM_STEP), false), [glideTo]);
  const zoomOut = useCallback(() => glideTo(clampZoom(latest.current.transform.scale / ZOOM_STEP), false), [glideTo]);
  const zoomToFit = useCallback(() => {
    const known = sizes();
    if (known) glideTo(fitZoom(known.viewport, known.image), true);
  }, [glideTo, sizes]);
  const zoomToActualSize = useCallback(() => glideTo(1, false), [glideTo]);
  const zoomToRect = useCallback(
    (rect: Point & Size) => move((_, viewport, image) => clampPan(rectTransform(viewport, rect), viewport, image), { animated: true, fitted: false }),
    [move],
  );

  // One observer for every viewport: a fitted view follows the pane's resizes (a splitter, the window), any other
  // stays within the edges.
  const resizeObserver = useMemo(
    () =>
      new ResizeObserver((entries) => {
        const element = entries[0]?.target;
        if (!(element instanceof HTMLElement) || !viewports.current.has(element)) return;
        measure(element);
        reconcile();
      }),
    [reconcile, measure],
  );
  useEffect(() => () => resizeObserver.disconnect(), [resizeObserver]);

  const onWheel = useCallback(
    (element: HTMLElement, event: WheelEvent): void => {
      // The wheel is ours: not the page's scroll, nor macOS's swipe back.
      event.preventDefault();
      // One gesture at a time: during a drag, or with the wheel button held (`buttons` bit 4), wheel deltas are the
      // pressed wheel tilting, not intent; the view would scroll by itself.
      if (dragging.current || (event.buttons & 4) !== 0) return;
      if (event.ctrlKey || event.metaKey) {
        const scale = wheelZoomScale(latest.current.transform.scale, event.deltaY, event.deltaMode === WheelEvent.DOM_DELTA_PIXEL);
        const anchor = pointIn(element, event);
        move((current, viewport, image) => zoomAroundPoint(current, scale, anchor, viewport, image), BY_HAND);
      } else {
        move((current, viewport, image) => pannedBy(current, -event.deltaX, -event.deltaY, viewport, image), BY_HAND);
      }
    },
    [move],
  );

  const onPointerDown = useCallback(
    (element: HTMLElement, event: PointerEvent): void => {
      if (!isDragButton(event.button) || isOnStageControl(event)) return;
      if (event.button === 1) event.preventDefault();
      if (!sizes()) return;
      const start = { x: event.clientX, y: event.clientY };
      const origin = latest.current.transform;
      dragging.current = true;
      setAnimated(false);
      followDrag(
        element,
        event.pointerId,
        (drag) => move((_, viewport, image) => pannedBy(origin, drag.clientX - start.x, drag.clientY - start.y, viewport, image), BY_HAND),
        () => (dragging.current = false),
      );
    },
    [move, sizes],
  );

  const onDoubleClick = useCallback(
    (element: HTMLElement, event: MouseEvent): void => {
      const known = sizes();
      if (isOnStageControl(event) || !known) return;
      if (doubleClickZoomsIn(latest.current.transform.scale)) glideTo(1, false, pointIn(element, event));
      else glideTo(fitZoom(known.viewport, known.image), true);
    },
    [glideTo, sizes],
  );

  const bindViewport = useCallback(
    (element: HTMLElement | null): undefined | (() => void) => {
      if (!element) return;
      viewports.current.add(element);
      measure(element);
      resizeObserver.observe(element);
      reconcile();
      const unbindGestures = bindGestures(element, { onWheel, onPointerDown, onDoubleClick });
      return () => {
        viewports.current.delete(element);
        resizeObserver.unobserve(element);
        unbindGestures();
        // The viewport left behind (another mode) measures the view again.
        const remaining = viewports.current.values().next().value;
        if (remaining) {
          measure(remaining);
          reconcile();
        }
      };
    },
    [resizeObserver, reconcile, measure, onWheel, onPointerDown, onDoubleClick],
  );

  return useMemo(
    () => ({ transform, viewport, animated, fitted, bindViewport, zoomIn, zoomOut, zoomToFit, zoomToActualSize, zoomToRect }),
    [transform, viewport, animated, fitted, bindViewport, zoomIn, zoomOut, zoomToFit, zoomToActualSize, zoomToRect],
  );
}

interface GestureHandlers {
  onWheel: (element: HTMLElement, event: WheelEvent) => void;
  onPointerDown: (element: HTMLElement, event: PointerEvent) => void;
  onDoubleClick: (element: HTMLElement, event: MouseEvent) => void;
}

/** Listens to a viewport's gestures, natively; returns what stops listening. */
function bindGestures(element: HTMLElement, handlers: GestureHandlers): () => void {
  const onWheel = (event: WheelEvent): void => handlers.onWheel(element, event);
  const onPointerDown = (event: PointerEvent): void => handlers.onPointerDown(element, event);
  const onDoubleClick = (event: MouseEvent): void => handlers.onDoubleClick(element, event);
  // Chromium arms its middle-button autoscroll on mousedown (cancelling pointerdown doesn't stop it): armed, it glides
  // the view while the pointer rests and swallows a release outside the window, a stuck pan.
  const onMouseDown = (event: MouseEvent): void => {
    if (event.button === 1) event.preventDefault();
  };
  // Not passive: only a listener that may cancel the wheel beats the page's scroll.
  element.addEventListener('wheel', onWheel, { passive: false });
  element.addEventListener('pointerdown', onPointerDown);
  element.addEventListener('mousedown', onMouseDown);
  element.addEventListener('dblclick', onDoubleClick);
  return () => {
    element.removeEventListener('wheel', onWheel);
    element.removeEventListener('pointerdown', onPointerDown);
    element.removeEventListener('mousedown', onMouseDown);
    element.removeEventListener('dblclick', onDoubleClick);
  };
}

/** Where a pointer event is in the element, in its own pixels. */
function pointIn(element: HTMLElement, event: MouseEvent): Point {
  const rect = element.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}
