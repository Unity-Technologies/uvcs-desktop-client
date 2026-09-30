import { isDiscreteWheel, wheelZoomFactor } from './zoom';

/** What a wheel or trackpad event does to the graph. */
export type WheelGesture =
  /** A wheel notch with ⌘ or Ctrl: an eased zoom step. */
  | { kind: 'zoomStep'; factor: number }
  /** A trackpad pinch (Chromium sends it as a wheel with Ctrl): the zoom follows the fingers. */
  | { kind: 'pinch'; factor: number }
  /** Scrolling moves the graph against the wheel; Shift turns a vertical wheel sideways. */
  | { kind: 'pan'; dx: number; dy: number };

type WheelInput = Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'ctrlKey' | 'metaKey' | 'shiftKey'>;

export function wheelGesture({ deltaX, deltaY, deltaMode, ctrlKey, metaKey, shiftKey }: WheelInput): WheelGesture {
  if (ctrlKey || metaKey) {
    return isDiscreteWheel(deltaY, deltaMode) ? { kind: 'zoomStep', factor: wheelZoomFactor(deltaY, deltaMode) } : { kind: 'pinch', factor: Math.exp(-deltaY * 0.01) };
  }
  const sideways = shiftKey && deltaX === 0;
  return { kind: 'pan', dx: -(sideways ? deltaY : deltaX), dy: -(sideways ? 0 : deltaY) };
}
