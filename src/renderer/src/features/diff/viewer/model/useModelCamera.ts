import { useCallback, useEffect, useRef, type RefObject } from 'react';
import type { ModelRenderer } from './modelRenderer';
import { framedView, type BoundsLike, type OrbitView } from './orbitCamera';
import { useSize } from './useSize';

const ANY_VIEW = framedView({ min: [-1, -1, -1], max: [1, 1, 1] }, 1);

/**
 * The viewer's camera: a ref, not state, so a drag redraws the canvas without rendering the panel again. The first
 * framing frames the pair whole; until the hand moves the camera, the app keeps the pair framed as the stage resizes
 * (the panel docking beside it, the window). Framing keeps the angle the camera has, as Unity's F does.
 */
export function useModelCamera(renderer: ModelRenderer | null, bounds: BoundsLike | null, stage: RefObject<HTMLElement | null>) {
  const view = useRef<OrbitView | null>(null);
  const framedByApp = useRef(true);
  const setView = useCallback(
    (next: OrbitView) => {
      view.current = next;
      renderer?.setView(next);
    },
    [renderer],
  );
  const frame = useCallback(
    (target: BoundsLike | null) => {
      if (!renderer || !target) return;
      const current = view.current;
      setView(current ? framedView(target, renderer.paneAspect(), current.yaw, current.pitch) : framedView(target, renderer.paneAspect()));
    },
    [renderer, setView],
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
  return { frame, frameFirst, onGesture, currentView };
}
