import { Plus } from 'lucide-react';
import { useMemo, type RefObject } from 'react';
import { useStore } from 'zustand';
import type { CodeLayout } from './lineActions';
import { dragSpanRect, lineActionDragBand, lineActionDragEnds, lineActionDragMoved } from './lineActionDrag';
import { LineBands } from './LineBands';
import { useLineBoxes } from './useLineBoxes';
import type { LineActionDragging } from './useLineActionDrag';
import styles from './LineActionButton.module.css';

interface LineActionDragMarksProps {
  dragging: LineActionDragging;
  containerRef: RefObject<HTMLElement | null>;
  layout: CodeLayout;
}

/**
 * While dragging from the "+", once off its line: the lines dragged over outlined in the accent, a "+" by the first and
 * the last. Before that, the button itself shows, as a press may still be a click.
 */
export function LineActionDragMarks({ dragging, containerRef, layout }: LineActionDragMarksProps) {
  const shown = useStore(dragging.shown);
  const bands = useMemo(() => (shown ? [lineActionDragBand(shown.drag)] : []), [shown]);
  const ends = useMemo(() => (shown ? lineActionDragEnds(shown.drag) : []), [shown]);
  const boxes = useLineBoxes(containerRef, ends, ends.map((end) => `${end.key}@${end.lineNumber}`).join('|'), layout);
  if (!shown || !lineActionDragMoved(shown.drag)) return null;
  const span = dragSpanRect(boxes.get('first'), boxes.get('last'), shown.left);
  return (
    <>
      <LineBands containerRef={containerRef} bands={bands} layout={layout} />
      {span && <span className={styles.dragSpan} style={span} aria-hidden />}
      {ends.map((end) => {
        const box = boxes.get(end.key);
        return box ? (
          <span key={end.key} className={styles.button} data-mark style={{ top: (box.top + box.bottom) / 2, left: shown.left }} aria-hidden>
            <Plus size={14} strokeWidth={2.75} />
          </span>
        ) : null;
      })}
    </>
  );
}
