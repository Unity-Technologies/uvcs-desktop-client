import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { trackPointerDrag } from '../lib/pointerDrag';
import styles from './SplitPane.module.css';

interface SplitPaneProps {
  /** Size in pixels of the sized pane. */
  initialSize: number;
  minSize?: number;
  maxSize?: number;
  direction?: 'horizontal' | 'vertical';
  /** Which pane keeps `initialSize`; the other one takes the remaining space. */
  sizedPane?: 'first' | 'second';
  first: ReactNode;
  second: ReactNode;
}

export function SplitPane({
  initialSize,
  minSize = 160,
  maxSize = 900,
  direction = 'horizontal',
  sizedPane = 'first',
  first,
  second,
}: SplitPaneProps) {
  const [size, setSize] = useState(initialSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const horizontal = direction === 'horizontal';

  const startDrag = (event: React.PointerEvent): void => {
    const bounds = containerRef.current!.getBoundingClientRect();
    trackPointerDrag(event, horizontal ? 'col-resize' : 'row-resize', (move) => {
      const fromStart = horizontal ? move.clientX - bounds.left : move.clientY - bounds.top;
      const offset = sizedPane === 'first' ? fromStart : (horizontal ? bounds.width : bounds.height) - fromStart;
      setSize(Math.min(maxSize, Math.max(minSize, offset)));
    });
  };

  const sizedStyle: CSSProperties = horizontal ? { width: size } : { height: size };
  const paneClass = (pane: 'first' | 'second'): string => (pane === sizedPane ? styles.pane : `${styles.pane} ${styles.rest}`);

  return (
    <div ref={containerRef} className={styles.split} data-direction={direction}>
      <div className={paneClass('first')} style={sizedPane === 'first' ? sizedStyle : undefined}>
        {first}
      </div>
      <div className={styles.handle} onPointerDown={startDrag} role="separator" />
      <div className={paneClass('second')} style={sizedPane === 'second' ? sizedStyle : undefined}>
        {second}
      </div>
    </div>
  );
}
