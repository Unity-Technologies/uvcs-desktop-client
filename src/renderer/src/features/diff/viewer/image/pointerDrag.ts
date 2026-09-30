/**
 * Controls layered over the stage, whose pointer the view never takes to pan, zoom or inspect: real controls, and
 * anything marked `data-no-pan` (the swipe divider, which drags on its own). The stage's listeners are native and run
 * before any React handler could stop the event, so they check this instead.
 */
export const STAGE_CONTROLS = 'button, input, [data-no-pan]';

/** Whether a press is on one of the `STAGE_CONTROLS`. */
export function isOnStageControl(event: Event): boolean {
  return event.target instanceof Element && event.target.closest(STAGE_CONTROLS) !== null;
}

/** The buttons that drag in the image viewer: the left, and the middle as image tools do; never the context menu's. */
export function isDragButton(button: number): boolean {
  return button === 0 || button === 1;
}

/**
 * Follows a drag started by a press on `element`: the pointer is captured, each move reported, and the drag ends on
 * release, cancel, or whenever the capture is lost (a release outside the window, the OS taking the mouse), so a drag
 * never outlives its button.
 */
export function followDrag(element: HTMLElement, pointerId: number, onMove: (event: PointerEvent) => void, onEnd?: () => void): void {
  element.setPointerCapture(pointerId);
  const end = (): void => {
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerup', end);
    element.removeEventListener('pointercancel', end);
    element.removeEventListener('lostpointercapture', end);
    onEnd?.();
  };
  element.addEventListener('pointermove', onMove);
  element.addEventListener('pointerup', end);
  element.addEventListener('pointercancel', end);
  element.addEventListener('lostpointercapture', end);
}
