import type { PointerEvent } from 'react';
import { trackPointerDrag } from '../lib/pointerDrag';
import styles from './ResizeHandle.module.css';

interface ResizeHandleProps {
  /** Current height of the element being sized. */
  size: number;
  min: number;
  max: number;
  onResize: (size: number) => void;
  /** The element's height when a drag starts, where it can differ from `size` (e.g. it grows to fill the space left). */
  measure?: () => number;
}

/** A splitter along the top edge of its positioned parent: dragging it up makes the sized element below it taller. */
export function ResizeHandle({ size, min, max, onResize, measure }: ResizeHandleProps) {
  const startDrag = (event: PointerEvent): void => {
    const startY = event.clientY;
    const startSize = measure?.() ?? size;
    trackPointerDrag(event, 'row-resize', (move) => onResize(Math.min(max, Math.max(min, startSize + startY - move.clientY))));
  };

  return <div className={styles.handle} role="separator" aria-orientation="horizontal" onPointerDown={startDrag} />;
}
