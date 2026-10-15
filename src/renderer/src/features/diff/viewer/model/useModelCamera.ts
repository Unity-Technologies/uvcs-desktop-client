import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { browserFrameClock } from '../../../../lib/frameClock';
import { prefersReducedMotion } from '../../../../lib/reducedMotion';
import { dollyGlide } from './dollyGlide';
import type { ModelRenderer } from './modelRenderer';
import { framedView, type BoundsLike, type OrbitView, type Vector } from './orbitCamera';
import { regionView } from './regionView';
import { useSize } from './useSize';
import { VIEW_GLIDE_MS, ViewGlide } from './viewGlide';

const ANY_VIEW = framedView({ min: [-1, -1, -1], max: [1, 1, 1] }, 1);

/**
 * The viewer's camera: a ref, not state, so a drag redraws the canvas without rendering the panel again. The first
 * framing frames the pair whole, at once; until the hand moves the camera or the app frames a part of the model, the
 * app keeps the pair framed as the stage resizes (the panel docking beside it, the window). Framing (F, 0, a part
 * picked) keeps the angle the camera has, as Unity's F does; a changed region stepped to turns to face it
 * (`regionView`). Both glide there (`ViewGlide`), as a wheel's notch does (`dollyGlide`); anything else that places the
 * camera stops a glide where it is.
 */
/** `bounds`: the pair's, once every version is in the renderer; null until then, when nothing frames. */
export function useModelCamera(renderer: ModelRenderer | null, bounds: BoundsLike | null, stage: RefObject<HTMLElement | null>) {
  const view = useRef<OrbitView | null>(null);
  const framedByApp = useRef(true);
  const place = useCallback(
    (next: OrbitView) => {
      view.current = next;
      renderer?.setView(next);
    },
    [renderer],
  );
  const dolly = useMemo(
    () =>
      dollyGlide(
        () => view.current ?? ANY_VIEW,
        (next) => {
          framedByApp.current = false;
          place(next);
        },
        browserFrameClock,
      ),
    [place],
  );
  const glide = useMemo(() => new ViewGlide(() => view.current ?? ANY_VIEW, place, browserFrameClock, () => (prefersReducedMotion() ? 0 : VIEW_GLIDE_MS)), [place]);
  useEffect(
    () => () => {
      dolly.stop();
      glide.stop();
    },
    [dolly, glide],
  );
  const setView = useCallback(
    (next: OrbitView) => {
      dolly.stop();
      glide.stop();
      place(next);
    },
    [place, dolly, glide],
  );
  /** Glides to `next`; with no view yet (nothing to glide from), places it at once. */
  const glideTo = useCallback(
    (next: OrbitView) => {
      if (!view.current) return setView(next);
      dolly.stop();
      glide.glideTo(next);
    },
    [setView, dolly, glide],
  );
  // Nothing frames before the pair does (`bounds` null): a part picked or F then would frame for a layout that isn't
  // the pair's yet, and the first framing would keep it.
  const framedOn = useCallback(
    (target: BoundsLike | null): OrbitView | null => {
      if (!renderer || !target || !bounds) return null;
      const current = view.current;
      return current ? framedView(target, renderer.paneAspect(), current.yaw, current.pitch) : framedView(target, renderer.paneAspect());
    },
    [renderer, bounds],
  );
  const frameAtOnce = useCallback(
    (target: BoundsLike | null) => {
      const next = framedOn(target);
      if (next) setView(next);
    },
    [framedOn, setView],
  );
  /** Glides to frame `target` (the pair, a part picked), keeping the camera's angle. */
  const frame = useCallback(
    (target: BoundsLike | null) => {
      const next = framedOn(target);
      if (!next) return;
      framedByApp.current = target === bounds;
      glideTo(next);
    },
    [framedOn, glideTo, bounds],
  );
  /** Glides to a changed region, turned to face it when it doesn't face the camera (`regionView`). */
  const frameRegion = useCallback(
    (region: BoundsLike) => {
      if (!renderer || !bounds) return;
      framedByApp.current = false;
      glideTo(regionView(region, bounds, view.current ?? ANY_VIEW, renderer.paneAspect()));
    },
    [renderer, bounds, glideTo],
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
    if (!view.current) frameAtOnce(bounds);
  }, [frameAtOnce, bounds]);
  const stageSize = useSize(stage);
  useEffect(() => {
    if (framedByApp.current && view.current) frameAtOnce(bounds);
  }, [stageSize, frameAtOnce, bounds]);
  const currentView = useCallback(() => view.current ?? ANY_VIEW, []);
  /** A wheel's notch: closer (`factor` over 1) or farther, towards the point under the pointer. */
  const onDollyStep = useCallback(
    (point: Vector | null, factor: number) => {
      glide.stop();
      dolly.zoomStep(point, factor);
    },
    [glide, dolly],
  );
  return { frame, frameRegion, frameFirst, onGesture, onDollyStep, currentView };
}
