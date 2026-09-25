import type { PointerEvent as ReactPointerEvent } from 'react';

/** Follows the pointer from a press until release, with `cursor` shown everywhere meanwhile (e.g. over a splitter). */
export function trackPointerDrag(event: ReactPointerEvent, cursor: string, onMove: (move: PointerEvent) => void): void {
  event.preventDefault();
  const onUp = (): void => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    document.body.style.cursor = '';
  };
  document.body.style.cursor = cursor;
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
}
