import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { browserFrameClock } from '../../../../lib/frameClock';
import { dollyGlide } from './dollyGlide';
import type { ModelRenderer } from './modelRenderer';
import { framedView, type BoundsLike, type OrbitView, type Vector } from './orbitCamera';
import { useSize } from './useSize';

const ANY_VIEW = framedView({ min: [-1, -1, -1], max: [1, 1, 1] }, 1);

/**
 * The viewer's camera: a ref, not state, so a drag redraws the canvas without rendering the panel again. The first
 * framing frames the pair whole; until the hand moves the camera, the app keeps the pair framed as the stage resizes
 * (the panel docking beside it, the window). Framing keeps the angle the camera has, as Unity's F does. A wheel's
 * notch glides (`dollyGlide`); anything else that places the camera stops the glide where it is.
 */
/** `bounds`: the pair's, once every version is in the renderer; null until then, when nothing frames. */
export function useModelCamera(renderer: ModelRenderer | null, bounds: BoundsLike | null, stage: RefObject<HTMLElement | null>) {
  const view = useRef<OrbitView | null>(null);
  const framedByApp = useRef(true);
  const glide = useMemo(
    () =>
      dollyGlide(
        () => view.current ?? ANY_VIEW,
        (next) => {
          framedByApp.current = false;
          view.current = next;
          renderer?.setView(next);
        },
        browserFrameClock,
      ),
    [renderer],
  );
  useEffect(() => () => glide.stop(), [glide]);
  const setView = useCallback(
    (next: OrbitView) => {
      glide.stop();
      view.current = next;
      renderer?.setView(next);
    },
    [renderer, glide],
  );
  const frame = useCallback(
    (target: BoundsLike | null) => {
      // Nothing frames before the pair does (`bounds` null): a part picked or F then would frame for a layout that
      // isn't the pair's yet, and the first framing would keep it.
      if (!renderer || !target || !bounds) return;
      const current = view.current;
      setView(current ? framedView(target, renderer.paneAspect(), current.yaw, current.pitch) : framedView(target, renderer.paneAspect()));
    },
    [renderer, setView, bounds],
  );
  /** What a gesture does: the hand has the camera from then on. */
  const onGesture = useCallback(
    (next: OrbitView) => {
      framedByApp.current = false;
      setView(next);
    },
    [setView],
  );
  /** Frames the pair once its models are in the renderer, unless the camera was placed already (the same pair read again). */
  const frameFirst = useCallback(() => {
    if (!view.current) frame(bounds);
  }, [frame, bounds]);
  const stageSize = useSize(stage);
  useEffect(() => {
    if (framedByApp.current && view.current) frame(bounds);
  }, [stageSize, frame, bounds]);
  const currentView = useCallback(() => view.current ?? ANY_VIEW, []);
  /** A wheel's notch: closer (`factor` over 1) or farther, towards the point under the pointer. */
  const onDollyStep = useCallback((point: Vector | null, factor: number) => glide.zoomStep(point, factor), [glide]);
  return { frame, frameFirst, onGesture, onDollyStep, currentView };
}
