// The model stage's pointer, as Unity's Scene view takes it: drag to orbit (Alt+drag too, Unity's habit), drag with
// the right or middle button or with Shift to pan, scroll or pinch to zoom at the pointer, double-click to orbit
// around the point clicked. A press that doesn't move is a click: it picks the part under it.

import { useEffect, useRef, type RefObject } from 'react';
import { followDrag, isOnStageControl } from '../image/pointerDrag';
import type { ModelRenderer } from './modelRenderer';
import { dollied, orbited, panned, type OrbitView, type Vector } from './orbitCamera';

/** A press that moves less than this, in pixels, is a click. */
const CLICK_SLOP = 4;
/** The point zoomed towards is looked for once per this long: a scroll fires many wheel events, picking costs a raycast. */
const ZOOM_POINT_MS = 150;

interface OrbitGestures {
  element: RefObject<HTMLElement | null>;
  renderer: ModelRenderer | null;
  view: () => OrbitView;
  onView: (view: OrbitView) => void;
  /** A click: what is under the pointer, in CSS pixels of the element. */
  onClick: (x: number, y: number) => void;
}

export function useOrbitGestures({ element, renderer, view, onView, onClick }: OrbitGestures): void {
  const latest = useRef({ view, onView, onClick });
  latest.current = { view, onView, onClick };

  useEffect(() => {
    const target = element.current;
    if (!target || !renderer) return;
    let zoomPoint: { at: number; point: Vector | null } = { at: -Infinity, point: null };
    const local = (event: MouseEvent): [number, number] => {
      const rect = target.getBoundingClientRect();
      return [event.clientX - rect.left, event.clientY - rect.top];
    };

    const onPointerDown = (event: PointerEvent): void => {
      if (isOnStageControl(event)) return;
      const pans = event.button === 1 || event.button === 2 || (event.button === 0 && event.shiftKey);
      if (!pans && event.button !== 0) return;
      event.preventDefault();
      target.focus({ preventScroll: true });
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
          const current = latest.current.view();
          latest.current.onView(pans ? panned(current, dx, dy, target.clientHeight) : orbited(current, dx, dy));
        },
        () => {
          if (travelled < CLICK_SLOP && !pans) latest.current.onClick(...local(event));
        },
      );
    };

    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      if (event.timeStamp - zoomPoint.at > ZOOM_POINT_MS) zoomPoint = { at: event.timeStamp, point: renderer.pick(...local(event))?.point ?? null };
      else zoomPoint.at = event.timeStamp;
      // A pinch arrives as a wheel with Ctrl and small deltas: as fast to the eye as a mouse's notches.
      const delta = event.ctrlKey ? event.deltaY * 8 : event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 33 : event.deltaY;
      latest.current.onView(dollied(latest.current.view(), delta, zoomPoint.point));
    };

    const onDoubleClick = (event: MouseEvent): void => {
      if (isOnStageControl(event)) return;
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
      target.removeEventListener('pointerdown', onPointerDown);
      target.removeEventListener('wheel', onWheel);
      target.removeEventListener('dblclick', onDoubleClick);
      target.removeEventListener('contextmenu', onContextMenu);
    };
  }, [element, renderer]);
}
