import { useRef, useState, type ReactNode } from 'react';
import { trackPointerDrag } from '../lib/pointerDrag';
import styles from './SplitPane.module.css';
import { paneRole, sizedPaneStyle } from './splitPaneSize';

interface SplitPaneProps {
  /** Size in pixels of the sized pane; double-clicking the splitter goes back to it. */
  initialSize: number;
  minSize?: number;
  maxSize?: number;
  /** What the other pane keeps at least as the split narrows, when more than `minSize` (`sizedPaneStyle`). */
  restMinSize?: number;
  /** Makes the size controlled, e.g. to remember it; `onSizeChange` reports drags and resets. */
  size?: number;
  onSizeChange?: (size: number) => void;
  direction?: 'horizontal' | 'vertical';
  /** Which pane keeps `initialSize`; the other one takes the remaining space. */
  sizedPane?: 'first' | 'second';
  /** Hides a pane and the splitter without remounting the other pane, which then fills the split. */
  hidden?: 'first' | 'second';
  first: ReactNode;
  second: ReactNode;
}

export function SplitPane({
  initialSize,
  minSize = 160,
  maxSize = 900,
  restMinSize,
  size: controlledSize,
  onSizeChange,
  direction = 'horizontal',
  sizedPane = 'first',
  hidden,
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

  const sizedStyle = sizedPaneStyle(horizontal, size, minSize, restMinSize);
  const pane = (which: 'first' | 'second', content: ReactNode): ReactNode => {
    const role = paneRole(which, sizedPane, hidden);
    if (role === 'hidden') return null;
    if (role === 'rest') return <div className={`${styles.pane} ${styles.rest}`}>{content}</div>;
    return (
      <div className={styles.pane} style={sizedStyle}>
        {content}
      </div>
    );
  };

  return (
    <div ref={containerRef} className={styles.split} data-direction={direction}>
      {pane('first', first)}
      {!hidden && (
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
