/** A press that moves less than this before coming up is a click, not a drag. */
const DRAG_THRESHOLD = 4;

export interface PointerDragHandlers {
  /** Each move once it is a drag, with how far the pointer went since the last one. */
  onDrag: (dx: number, dy: number, move: PointerEvent) => void;
  /** The pointer came up after dragging. */
  onDragEnd: () => void;
  /** The pointer came up without dragging. */
  onClick: (up: PointerEvent) => void;
}

/** Follows the pointer from a press until it comes up, anywhere in the window, telling a drag from a click. */
export function followPointerDrag(press: { clientX: number; clientY: number }, { onDrag, onDragEnd, onClick }: PointerDragHandlers): void {
  const start = { x: press.clientX, y: press.clientY };
  let last = start;
  let dragging = false;
  const onMove = (move: PointerEvent): void => {
    if (!dragging && Math.hypot(move.clientX - start.x, move.clientY - start.y) < DRAG_THRESHOLD) return;
    dragging = true;
    onDrag(move.clientX - last.x, move.clientY - last.y, move);
    last = { x: move.clientX, y: move.clientY };
  };
  const onUp = (up: PointerEvent): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    if (dragging) onDragEnd();
    else onClick(up);
  };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}
