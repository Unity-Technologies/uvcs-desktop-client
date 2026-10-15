import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { browserFrameClock } from '../../../../lib/frameClock';
import { prefersReducedMotion } from '../../../../lib/reducedMotion';
import { ModelCameraControl } from './modelCameraControl';
import type { ModelRenderer } from './modelRenderer';
import type { BoundsLike, OrbitView, Vector } from './orbitCamera';
import { useSize } from './useSize';
import { VIEW_GLIDE_MS } from './viewGlide';

/**
 * The viewer's camera (`ModelCameraControl`, where its rules are), wired to React: not state, so a drag redraws the
 * canvas without rendering the panel again. Every move of the camera reaches the renderer through `onCameraMove`.
 */
/** `bounds`: the pair's, once every version is in the renderer; null until then, when nothing frames. */
export function useModelCamera(renderer: ModelRenderer | null, bounds: BoundsLike | null, stage: RefObject<HTMLElement | null>) {
  const latestRenderer = useRef(renderer);
  latestRenderer.current = renderer;
  const [control] = useState(
    () =>
      new ModelCameraControl({
        onCameraMove: (view) => latestRenderer.current?.setView(view),
        paneAspect: () => latestRenderer.current?.paneAspect() ?? 1,
        clock: browserFrameClock,
        glideMs: () => (prefersReducedMotion() ? 0 : VIEW_GLIDE_MS),
      }),
  );
  useEffect(() => () => control.stopGlides(), [control]);
  // Nothing frames before the pair does: a row picked or F then would frame for a layout that isn't the pair's yet,
  // and the first framing would keep it.
  useEffect(() => control.setBounds(renderer ? bounds : null), [control, renderer, bounds]);
  const stageSize = useSize(stage);
  useEffect(() => control.followResize(), [control, stageSize, bounds]);
  return useMemo(
    () => ({
      frameFirst: () => control.frameFirst(),
      frameWhole: () => control.frameWhole(),
      framePart: (part: BoundsLike) => control.framePart(part),
      frameRegion: (region: BoundsLike) => control.frameRegion(region),
      onGesture: (view: OrbitView) => control.onGesture(view),
      /** A wheel's notch: closer (`factor` over 1) or farther, towards the point under the pointer. */
      onDollyStep: (point: Vector | null, factor: number) => control.onDollyStep(point, factor),
      currentView: () => control.currentView(),
      /** What stops the hand's moves still under way (`useOrbitGestures`' coasts) before the app frames. */
      setInterrupt: (interrupt: () => void) => control.setInterrupt(interrupt),
    }),
    [control],
  );
}
