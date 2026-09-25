import type { PointerEvent } from 'react';
import { trackPointerDrag } from '../lib/pointerDrag';
import styles from './ResizeHandle.module.css';

interface ResizeHandleProps {
  /** Current height of the element being sized. */
  size: number;
  min: number;
  max: number;
  onResize: (size: number) => void;
}

/** A splitter along the top edge of its positioned parent: dragging it up makes the sized element below it taller. */
export function ResizeHandle({ size, min, max, onResize }: ResizeHandleProps) {
  const startDrag = (event: PointerEvent): void => {
    const startY = event.clientY;
    trackPointerDrag(event, 'row-resize', (move) => onResize(Math.min(max, Math.max(min, size + startY - move.clientY))));
  };

  return <div className={styles.handle} role="separator" aria-orientation="horizontal" onPointerDown={startDrag} />;
}
