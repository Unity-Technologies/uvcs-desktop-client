import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { browserFrameClock } from '../../../../lib/frameClock';
import { FlyKeysLoop } from './flyKeysLoop';
import type { OrbitView, Vector } from './orbitCamera';

interface FlyKeys {
  view: () => OrbitView;
  onView: (view: OrbitView) => void;
  modelCentre: () => Vector | null;
}

/** The model pane's W, A, S, D, Q, E and arrows (`FlyKeysLoop`), as its key handlers. */
export function useFlyKeys({ view, onView, modelCentre }: FlyKeys) {
  const latest = useRef({ view, onView, modelCentre });
  latest.current = { view, onView, modelCentre };
  const loop = useMemo(
    () =>
      new FlyKeysLoop(
        () => latest.current.view(),
        (next) => latest.current.onView(next),
        () => latest.current.modelCentre(),
        browserFrameClock,
      ),
    [],
  );
  useEffect(() => () => loop.stop(), [loop]);
  return useMemo(
    () => ({
      /** Whether the key moves the camera (the caller then lets it do nothing else). */
      onKeyDown: (event: KeyboardEvent): boolean => loop.keyDown(event.nativeEvent),
      onKeyUp: (event: KeyboardEvent): void => loop.keyUp(event.nativeEvent),
      onBlur: (): void => loop.stop(),
    }),
    [loop],
  );
}
