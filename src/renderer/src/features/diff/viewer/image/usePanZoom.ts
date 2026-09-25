// Shared pan/zoom state for the image viewer. One instance is owned by the
// viewer host and passed to whichever mode is active, so switching between
// onion skin / side-by-side / differences / swipe keeps the exact framing —
// you never lose the pixel you were inspecting.
//
// Interaction model (the muscle memory of every image tool):
//   wheel / two-finger scroll   pan
//   pinch, Ctrl/Cmd + wheel     zoom at the cursor
//   drag                        pan
//   double-click                toggle fit ⇄ 100% (animated, into the click)
//   +/− buttons, fit, 1:1       animated zoom
// Programmatic zooms glide via a CSS transition on the world transform;
// direct manipulation (wheel/pinch/drag) is always instant — animation under
// the finger reads as lag, not delight.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  centeredTransform,
  clampPan,
  clampZoom,
  fitZoom,
  rectTransform,
  type ViewTransform,
  ZOOM_STEP,
  zoomAroundPoint,
} from './imageDiff';

type Size = { width: number; height: number };

/** Elements over the stage whose pointer interactions must never pan/zoom:
 *  real controls, plus anything marked `data-no-pan` (the swipe handle). */
const NO_PAN_TARGETS = 'button, input, [data-no-pan]';

export interface PanZoom {
  /** Current transform; apply as `translate(x, y) scale(scale)`. */
  transform: ViewTransform;
  /** Viewport (pane) size in screen px; null until a viewport is measured.
   *  The checkerboard backdrop uses it to stay viewport-bounded instead of
   *  ballooning to the full scaled world rect at deep zoom. */
  viewport: Size | null;
  /** True while a button/double-click zoom glides (drives the CSS transition). */
  animated: boolean;
  /** True when the view is in "fit" mode (auto re-fits on pane resize). */
  fitted: boolean;
  /**
   * Ref callback for every viewport element rendering the shared world
   * (side-by-side binds two). Wires wheel/pinch/drag/double-click and size
   * tracking; React 19 ref cleanups detach when the mode unmounts.
   */
  bindViewport: (el: HTMLElement | null) => undefined | (() => void);
  zoomIn: () => void;
  zoomOut: () => void;
  zoomToFit: () => void;
  zoomToActualSize: () => void;
  /** Animated jump that frames `rect` (image coords) — region navigation. */
  zoomToRect: (rect: { x: number; y: number; width: number; height: number }) => void;
}

/**
 * `imageSize` is the composed frame both revisions share (max of the two
 * natural sizes); null until the images decode. The view starts fitted —
 * never upscaled past 100% — exactly like the UVCS viewer.
 */
export function usePanZoom(imageSize: Size | null): PanZoom {
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, x: 0, y: 0 });
  const [animated, setAnimated] = useState(false);
  const [fitted, setFitted] = useState(true);
  // Reactive mirror of frameRef, for renderers that need the viewport rect
  // (the checkerboard clips itself to the world's screen rect — see World).
  const [viewport, setViewport] = useState<Size | null>(null);

  // Bound viewport elements. Simultaneous viewports are layout twins (the
  // side-by-side halves), so any one of them measures the shared frame.
  const viewports = useRef(new Set<HTMLElement>());
  // True while a button drag pans the view. A drag owns the gesture: wheel
  // events that arrive mid-drag are noise (tilt wheels physically nudge
  // sideways while the wheel button is pressed) and must not also pan.
  const dragging = useRef(false);
  const frameRef = useRef<Size | null>(null);
  // Record the viewport size in both the synchronous ref (read by gesture
  // handlers) and the reactive state (read while rendering).
  const measure = useCallback((el: HTMLElement) => {
    const size = { width: el.clientWidth, height: el.clientHeight };
    frameRef.current = size;
    setViewport(size);
  }, []);
  const imageRef = useRef(imageSize);
  imageRef.current = imageSize;
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const fittedRef = useRef(fitted);
  fittedRef.current = fitted;

  const applyFit = useCallback(() => {
    const frame = frameRef.current;
    const image = imageRef.current;
    if (!frame || !image) return;
    setTransform(centeredTransform(fitZoom(frame, image), frame, image));
  }, []);

  /** Re-clamp (or re-fit) after the frame or image changed shape. */
  const reconcile = useCallback(() => {
    const frame = frameRef.current;
    const image = imageRef.current;
    if (!frame || !image) return;
    setAnimated(false);
    if (fittedRef.current) applyFit();
    else setTransform((t) => clampPan(t, frame, image));
  }, [applyFit]);

  // A new image landed (file selection changed): reset to a fitted view —
  // inheriting the previous file's deep zoom would show arbitrary pixels.
  useEffect(() => {
    setFitted(true);
    setAnimated(false);
    applyFit();
  }, [imageSize, applyFit]);

  /** Instant zoom at a viewport point (wheel/pinch). */
  const zoomAt = useCallback((nextScale: number, anchor: { x: number; y: number }) => {
    const frame = frameRef.current;
    const image = imageRef.current;
    if (!frame || !image) return;
    setAnimated(false);
    setFitted(false);
    setTransform((t) => zoomAroundPoint(t, nextScale, anchor, frame, image));
  }, []);

  /** Animated zoom to a scale, anchored at `anchor` (default: frame center). */
  const glideTo = useCallback((nextScale: number, fit: boolean, anchor?: { x: number; y: number }) => {
    const frame = frameRef.current;
    const image = imageRef.current;
    if (!frame || !image) return;
    setAnimated(true);
    setFitted(fit);
    const at = anchor ?? { x: frame.width / 2, y: frame.height / 2 };
    setTransform((t) => zoomAroundPoint(t, nextScale, at, frame, image));
  }, []);

  const zoomIn = useCallback(() => glideTo(clampZoom(transformRef.current.scale * ZOOM_STEP), false), [glideTo]);
  const zoomOut = useCallback(() => glideTo(clampZoom(transformRef.current.scale / ZOOM_STEP), false), [glideTo]);
  const zoomToFit = useCallback(() => {
    const frame = frameRef.current;
    const image = imageRef.current;
    if (!frame || !image) return;
    glideTo(fitZoom(frame, image), true);
  }, [glideTo]);
  const zoomToActualSize = useCallback(() => glideTo(1, false), [glideTo]);

  const zoomToRect = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    const frame = frameRef.current;
    const image = imageRef.current;
    if (!frame || !image) return;
    setAnimated(true);
    setFitted(false);
    // Unlike fitZoom this upscales happily — jumping to a 4-pixel region is
    // the whole point — capped so a nick doesn't become a wall of texels.
    setTransform(clampPan(rectTransform(frame, rect), frame, image));
  }, []);

  // One observer for every bound viewport: fit mode follows pane resizes
  // (sidebar splitter drags, window resizes); free mode just re-clamps.
  const resizeObserver = useMemo(
    () =>
      new ResizeObserver((entries) => {
        const el = entries[0]?.target as HTMLElement | undefined;
        if (!el || !viewports.current.has(el)) return;
        measure(el);
        reconcile();
      }),
    [reconcile, measure],
  );
  useEffect(() => () => resizeObserver.disconnect(), [resizeObserver]);

  const onPointerDown = useCallback((el: HTMLElement, e: PointerEvent) => {
    // Left or middle button (the image-tool convention: middle-drag pans);
    // leave controls layered over the stage alone. The check must happen
    // here, natively: this listener fires while the event bubbles to the
    // viewport, before any React synthetic handler — a control's
    // stopPropagation would arrive too late to stop the pan. `data-no-pan`
    // marks stage controls with their own drag (swipe divider).
    if ((e.button !== 0 && e.button !== 1) || (e.target as HTMLElement).closest(NO_PAN_TARGETS)) return;
    // Middle button: cancel the pointer default too (the mousedown listener
    // in bindViewport is what actually disarms Chromium's autoscroll).
    if (e.button === 1) e.preventDefault();
    const frame = frameRef.current;
    const image = imageRef.current;
    if (!frame || !image) return;
    const start = { x: e.clientX, y: e.clientY };
    const origin = transformRef.current;
    el.setPointerCapture(e.pointerId);
    dragging.current = true;
    setAnimated(false);
    const onMove = (ev: PointerEvent) => {
      setFitted(false);
      setTransform(
        clampPan(
          {
            scale: origin.scale,
            x: origin.x + (ev.clientX - start.x),
            y: origin.y + (ev.clientY - start.y),
          },
          frame,
          image,
        ),
      );
    };
    const onUp = () => {
      dragging.current = false;
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('lostpointercapture', onUp);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    // Safety net: if the capture is lost without a pointerup reaching us
    // (release outside the window, element churn, the OS stealing the mouse),
    // the drag must still end — a pan that survives its button is a stuck UI.
    el.addEventListener('lostpointercapture', onUp);
  }, []);

  const onDoubleClick = useCallback(
    (el: HTMLElement, e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(NO_PAN_TARGETS)) return;
      const rect = el.getBoundingClientRect();
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const frame = frameRef.current;
      const image = imageRef.current;
      if (!frame || !image) return;
      // Below 100%: dive to actual size into the click; otherwise back to fit.
      if (transformRef.current.scale < 0.999) glideTo(1, false, anchor);
      else glideTo(fitZoom(frame, image), true);
    },
    [glideTo],
  );

  const bindViewport = useCallback(
    (el: HTMLElement | null): undefined | (() => void) => {
      if (!el) return;
      viewports.current.add(el);
      measure(el);
      resizeObserver.observe(el);
      reconcile();

      // Wheel must be a native non-passive listener: preventDefault has to
      // beat the page scroll and macOS back-swipe. Pinch = wheel + ctrlKey.
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        // One gesture at a time: while a drag pans (or the wheel button is
        // held at all — `buttons` bit 4), wheel deltas are tilt-wheel noise
        // from the pressed wheel, not intent. Without this the view "scrolls
        // by itself" under a held middle button.
        if (dragging.current || (e.buttons & 4) !== 0) return;
        const frame = frameRef.current;
        const image = imageRef.current;
        if (!frame || !image) return;
        if (e.ctrlKey || e.metaKey) {
          const rect = el.getBoundingClientRect();
          // Exponential mapping keeps pinch speed proportional at any zoom.
          // Trackpad pinches stream many small deltas; a mouse wheel fires
          // one big notch (±100ish pixels, or line-mode deltas) that would
          // jump several zoom levels at once. Clamping the per-event delta
          // caps a notch at a gentle ~1.2× step while leaving the small
          // pinch deltas untouched.
          const raw = e.deltaMode === WheelEvent.DOM_DELTA_PIXEL ? e.deltaY : e.deltaY * 16;
          const delta = Math.max(-16, Math.min(16, raw));
          zoomAt(transformRef.current.scale * Math.exp(-delta * 0.012), {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
          });
        } else {
          setAnimated(false);
          setFitted(false);
          setTransform((t) => clampPan({ scale: t.scale, x: t.x - e.deltaX, y: t.y - e.deltaY }, frame, image));
        }
      };
      const onDown = (e: PointerEvent) => onPointerDown(el, e);
      const onDbl = (e: MouseEvent) => onDoubleClick(el, e);
      // Middle-button autoscroll arms on the *mousedown* default action —
      // canceling pointerdown does not stop it. Armed, it keeps gliding the
      // view while the cursor rests mid-drag, and it swallows the pointerup
      // when the button is released outside the window (a stuck pan). Kill it
      // at the source so middle-drag behaves exactly like left-drag.
      const onMouseDown = (e: MouseEvent) => {
        if (e.button === 1) e.preventDefault();
      };
      el.addEventListener('wheel', onWheel, { passive: false });
      el.addEventListener('pointerdown', onDown);
      el.addEventListener('mousedown', onMouseDown);
      el.addEventListener('dblclick', onDbl);
      return () => {
        viewports.current.delete(el);
        resizeObserver.unobserve(el);
        el.removeEventListener('wheel', onWheel);
        el.removeEventListener('pointerdown', onDown);
        el.removeEventListener('mousedown', onMouseDown);
        el.removeEventListener('dblclick', onDbl);
        // The surviving viewport (mode switch) re-measures the frame.
        const next = viewports.current.values().next().value;
        if (next) {
          measure(next);
          reconcile();
        }
      };
    },
    [resizeObserver, reconcile, zoomAt, onPointerDown, onDoubleClick, measure],
  );

  return useMemo(
    () => ({
      transform,
      viewport,
      animated,
      fitted,
      bindViewport,
      zoomIn,
      zoomOut,
      zoomToFit,
      zoomToActualSize,
      zoomToRect,
    }),
    [transform, viewport, animated, fitted, bindViewport, zoomIn, zoomOut, zoomToFit, zoomToActualSize, zoomToRect],
  );
}
