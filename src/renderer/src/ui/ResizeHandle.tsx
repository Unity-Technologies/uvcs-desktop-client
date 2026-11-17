import type { PointerEvent } from 'react';
import { trackPointerDrag } from '../lib/pointerDrag';
import { resizedSize, type ResizeEdge } from './resizeHandleSize';
import styles from './ResizeHandle.module.css';

interface ResizeHandleProps {
  /** Current height of the element being sized. */
  size: number;
  min: number;
  max: number;
  onResize: (size: number) => void;
  /** The element's height when a drag starts, where it can differ from `size` (e.g. it grows to fill the space left). */
  measure?: () => number;
  /** The edge of its positioned parent it sits on: `top` by default (a pane at the bottom), `bottom` for a list on top. */
  edge?: ResizeEdge;
  /** Double-clicking the splitter gives the element back its own height, as `SplitPane`'s does. */
  onReset?: () => void;
}

/** A splitter along an edge of its positioned parent: dragging it away from the sized element makes it taller. */
export function ResizeHandle({ size, min, max, onResize, measure, edge = 'top', onReset }: ResizeHandleProps) {
  const startDrag = (event: PointerEvent): void => {
    const startY = event.clientY;
    const startSize = measure?.() ?? size;
    trackPointerDrag(event, 'row-resize', (move) => onResize(resizedSize(edge, { startSize, startY, y: move.clientY }, min, max)));
  };

  return (
    <div
      className={styles.handle}
      data-edge={edge}
      role="separator"
      aria-orientation="horizontal"
      onPointerDown={startDrag}
      onDoubleClick={onReset}
    />
  );
}
