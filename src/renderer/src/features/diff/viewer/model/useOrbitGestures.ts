// The model stage's pointer, as Unity's Scene view takes it: drag to orbit (Alt+drag too, Unity's habit), drag with
// the right or middle button or with Shift to pan (either coasts a little once let go: `SHORT_FLING`), scroll or pinch to zoom at the pointer (a wheel's notches glide:
// `dollyGlide`), double-click to orbit around the point clicked. A press that doesn't move is a click: it picks the part under it.

import { useEffect, useRef, type RefObject } from 'react';
import { SHORT_FLING, type FlingFeel } from '../../../../lib/fling';
import { browserFrameClock } from '../../../../lib/frameClock';
import { PanInertia } from '../../../../lib/panInertia';
import { isDiscreteWheel, wheelZoomFactor } from '../../../../lib/wheelZoom';
import { followDrag, isOnStageControl } from '../image/pointerDrag';
import type { ModelRenderer } from './modelRenderer';
import { dollied, orbited, panned, type OrbitView, type Vector } from './orbitCamera';

/**
 * How a turn coasts once let go: much less than a pan, as each pixel turns the model (`orbited`): a slow release turns
 * it on by a few degrees, the hardest flick about 30°. The pan's coast on a turn spun the model round and more.
 */
const TURN_FLING: FlingFeel = { maxSpeed: 1, tauMinMs: 50, tauMaxMs: 90, tauPerSpeedMs: 40 };

/** A press that moves less than this, in pixels, is a click. */
const CLICK_SLOP = 4;
/** The point zoomed towards is looked for once per this long: a scroll fires many wheel events, picking costs a raycast. */
const ZOOM_POINT_MS = 150;

interface OrbitGestures {
  element: RefObject<HTMLElement | null>;
  renderer: ModelRenderer | null;
  view: () => OrbitView;
  onView: (view: OrbitView) => void;
  /** A wheel's notch: closer (`factor` over 1) or farther, towards the point under the pointer. */
  onDollyStep: (point: Vector | null, factor: number) => void;
  /** A click: what is under the pointer, in CSS pixels of the element. */
  onClick: (x: number, y: number) => void;
}

export function useOrbitGestures({ element, renderer, view, onView, onDollyStep, onClick }: OrbitGestures): void {
  const latest = useRef({ view, onView, onDollyStep, onClick });
  latest.current = { view, onView, onDollyStep, onClick };

  useEffect(() => {
    const target = element.current;
    if (!target || !renderer) return;
    let zoomPoint: { at: number; point: Vector | null } = { at: -Infinity, point: null };
    // A drag coasts on as it went once let go; the model turns and pans without bounds, as far as asked.
    const panInertia = new PanInertia(
      (dx, dy) => {
        latest.current.onView(panned(latest.current.view(), dx, dy, target.clientHeight));
        return { dx, dy };
      },
      browserFrameClock,
      SHORT_FLING,
    );
    const turnInertia = new PanInertia(
      (dx, dy) => {
        latest.current.onView(orbited(latest.current.view(), dx, dy));
        return { dx, dy };
      },
      browserFrameClock,
      TURN_FLING,
    );
    const stopCoasting = (): void => {
      panInertia.cancel();
      turnInertia.cancel();
    };
    const local = (event: MouseEvent): [number, number] => {
      const rect = target.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (isOnStageControl(event)) return;
      const pans = event.button === 1 || event.button === 2 || (event.button === 0 && event.shiftKey);
      if (!pans && event.button !== 0) return;
      event.preventDefault();
      stopCoasting();
      target.focus({ preventScroll: true });
      const inertia = pans ? panInertia : turnInertia;
      inertia.sample(event.clientX, event.clientY, event.timeStamp);
      let last = { x: event.clientX, y: event.clientY };
      let travelled = 0;
      followDrag(
        target,
        event.pointerId,
        (move) => {
          const dx = move.clientX - last.x;
          const dy = move.clientY - last.y;
          last = { x: move.clientX, y: move.clientY };
          travelled += Math.abs(dx) + Math.abs(dy);
          inertia.sample(move.clientX, move.clientY, move.timeStamp);
          const current = latest.current.view();
          latest.current.onView(pans ? panned(current, dx, dy, target.clientHeight) : orbited(current, dx, dy));
        },
        () => {
          if (travelled < CLICK_SLOP && !pans) latest.current.onClick(...local(event));
          else inertia.release();
        },
      );
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      stopCoasting();
      if (event.timeStamp - zoomPoint.at > ZOOM_POINT_MS) zoomPoint = { at: event.timeStamp, point: renderer.pick(...local(event))?.point ?? null };
      else zoomPoint.at = event.timeStamp;
      if (isDiscreteWheel(event.deltaY, event.deltaMode)) {
        latest.current.onDollyStep(zoomPoint.point, wheelZoomFactor(event.deltaY, event.deltaMode));
        return;
      }
      // A pinch arrives as a wheel with Ctrl and small deltas: as fast to the eye as a trackpad's scroll.
      const delta = event.ctrlKey ? event.deltaY * 8 : event.deltaY;
      latest.current.onView(dollied(latest.current.view(), delta, zoomPoint.point));
    };

    const onDoubleClick = (event: MouseEvent): void => {
      if (isOnStageControl(event)) return;
      stopCoasting();
      const point = renderer.pick(...local(event))?.point;
      if (point) latest.current.onView({ ...latest.current.view(), target: point });
    };

    // The right button pans: no context menu over the model.
    const onContextMenu = (event: MouseEvent): void => {
      if (!isOnStageControl(event)) event.preventDefault();
    };

    target.addEventListener('pointerdown', onPointerDown);
    // Not passive: only a listener that may cancel the wheel beats the page's scroll and macOS's swipe back.
    target.addEventListener('wheel', onWheel, { passive: false });
    target.addEventListener('dblclick', onDoubleClick);
    target.addEventListener('contextmenu', onContextMenu);
    return () => {
      stopCoasting();
      target.removeEventListener('pointerdown', onPointerDown);
      target.removeEventListener('wheel', onWheel);
      target.removeEventListener('dblclick', onDoubleClick);
      target.removeEventListener('contextmenu', onContextMenu);
    };
  }, [element, renderer]);
}
