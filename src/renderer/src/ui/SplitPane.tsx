import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { trackPointerDrag } from '../lib/pointerDrag';
import styles from './SplitPane.module.css';

interface SplitPaneProps {
  /** Size in pixels of the sized pane; double-clicking the splitter goes back to it. */
  initialSize: number;
  minSize?: number;
  maxSize?: number;
  /** Makes the size controlled, e.g. to remember it; `onSizeChange` reports drags and resets. */
  size?: number;
  onSizeChange?: (size: number) => void;
  direction?: 'horizontal' | 'vertical';
  /** Which pane keeps `initialSize`; the other one takes the remaining space. */
  sizedPane?: 'first' | 'second';
  /** Hides the sized pane and the splitter without remounting the other pane. */
  hideSized?: boolean;
  first: ReactNode;
  second: ReactNode;
}

export function SplitPane({
  initialSize,
  minSize = 160,
  maxSize = 900,
  size: controlledSize,
  onSizeChange,
  direction = 'horizontal',
  sizedPane = 'first',
  hideSized = false,
  first,
  second,
}: SplitPaneProps) {
  const [ownSize, setOwnSize] = useState(initialSize);
  const containerRef = useRef<HTMLDivElement>(null);
  const horizontal = direction === 'horizontal';
  const clamp = (value: number): number => Math.min(maxSize, Math.max(minSize, value));
  const size = clamp(controlledSize ?? ownSize);

  const resize = (value: number): void => {
    setOwnSize(value);
    onSizeChange?.(value);
  };

  const startDrag = (event: React.PointerEvent): void => {
    const bounds = containerRef.current!.getBoundingClientRect();
    trackPointerDrag(event, horizontal ? 'col-resize' : 'row-resize', (move) => {
      const fromStart = horizontal ? move.clientX - bounds.left : move.clientY - bounds.top;
      const offset = sizedPane === 'first' ? fromStart : (horizontal ? bounds.width : bounds.height) - fromStart;
      resize(clamp(offset));
    });
  };

  const sizedStyle: CSSProperties = horizontal ? { width: size } : { height: size };
  const pane = (which: 'first' | 'second', content: ReactNode): ReactNode => {
    if (which !== sizedPane) return <div className={`${styles.pane} ${styles.rest}`}>{content}</div>;
    return hideSized ? null : (
      <div className={styles.pane} style={sizedStyle}>
        {content}
      </div>
    );
  };

  return (
    <div ref={containerRef} className={styles.split} data-direction={direction}>
      {pane('first', first)}
      {!hideSized && (
        <div
          className={styles.handle}
          onPointerDown={startDrag}
          onDoubleClick={() => resize(initialSize)}
          role="separator"
          aria-orientation={horizontal ? 'vertical' : 'horizontal'}
        />
      )}
      {pane('second', second)}
    </div>
  );
}
