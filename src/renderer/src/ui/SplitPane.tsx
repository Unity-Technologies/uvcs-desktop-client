import { useRef, useState, type ReactNode } from 'react';
import styles from './SplitPane.module.css';

interface SplitPaneProps {
  /** Size in pixels of the first pane. */
  initialSize: number;
  minSize?: number;
  maxSize?: number;
  direction?: 'horizontal' | 'vertical';
  first: ReactNode;
  second: ReactNode;
}

export function SplitPane({ initialSize, minSize = 160, maxSize = 900, direction = 'horizontal', first, second }: SplitPaneProps) {
  const [size, setSize] = useState(initialSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const horizontal = direction === 'horizontal';

  const startDrag = (event: React.PointerEvent): void => {
    event.preventDefault();
    const origin = containerRef.current!.getBoundingClientRect();
    const onMove = (move: PointerEvent): void => {
      const offset = horizontal ? move.clientX - origin.left : move.clientY - origin.top;
      setSize(Math.min(maxSize, Math.max(minSize, offset)));
    };
    const onUp = (): void => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = horizontal ? 'col-resize' : 'row-resize';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div ref={containerRef} className={styles.split} data-direction={direction}>
      <div className={styles.pane} style={horizontal ? { width: size } : { height: size }}>
        {first}
      </div>
      <div className={styles.handle} onPointerDown={startDrag} role="separator" />
      <div className={`${styles.pane} ${styles.rest}`}>{second}</div>
    </div>
  );
}
