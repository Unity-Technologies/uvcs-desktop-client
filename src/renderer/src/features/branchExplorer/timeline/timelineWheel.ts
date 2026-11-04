import { wheelGesture, type WheelGesture } from '../canvas/wheelGesture';
import type { Size, Viewport } from '../canvas/viewport';
import { worldXOfStrip, type TimelineAxis } from './timelineAxis';

/** What a wheel over the Timeline does: the canvas pans sideways (whichever way the wheel turns), or zooms with ⌘ or Ctrl. */
export type TimelineWheel = { kind: 'pan'; dx: number } | Extract<WheelGesture, { kind: 'zoomStep' | 'pinch' }>;

export function timelineWheel(event: Parameters<typeof wheelGesture>[0]): TimelineWheel {
  const gesture = wheelGesture(event);
  if (gesture.kind !== 'pan') return gesture;
  // The strip has one direction: a vertical wheel moves along it too, at the canvas's own speed.
  return { kind: 'pan', dx: Math.abs(gesture.dx) >= Math.abs(gesture.dy) ? gesture.dx : gesture.dy };
}

/** Where on the canvas a zoom from the strip centers: the point of the graph under the pointer, kept within the screen. */
export function zoomAnchorX(axis: TimelineAxis, viewport: Viewport, screen: Size, x: number): number {
  return Math.min(screen.width, Math.max(0, worldXOfStrip(axis, x) * viewport.zoom + viewport.panX));
}
