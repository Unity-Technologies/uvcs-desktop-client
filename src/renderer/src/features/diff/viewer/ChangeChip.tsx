import { Undo2, X } from 'lucide-react';
import { useLayoutEffect, useState, type RefObject } from 'react';
import { Kbd } from '../../../ui/Kbd';
import type { ChangedLine } from './changeBlocks';
import { describeDiscard } from './discardAction';
import styles from './PickedLinesBar.module.css';
import { hotkey } from '../../../lib/shortcutRegistry';


interface PickedLinesBarProps {
  /** The scrolling element around the diff, which the bar is placed in. */
  containerRef: RefObject<HTMLElement | null>;
  lines: ChangedLine[];
  /** The lines the bar would discard while the pointer is on its action, to preview the result. */
  onPreview: (lines: ChangedLine[] | null) => void;
  onDiscard: (lines: ChangedLine[]) => void;
  onClear: () => void;
}

/** Floats under the last picked line: discards just the picked lines, or drops the pick. */
export function PickedLinesBar({ containerRef, lines, onPreview, onDiscard, onClear }: PickedLinesBarProps) {
  const position = useLastPickedRow(containerRef, lines);
  if (!position || lines.length === 0) return null;

  const action = describeDiscard(lines);
  return (
    <div className={styles.bar} style={position} role="toolbar" aria-label="Picked lines">
      <button
        type="button"
        className={styles.discard}
        data-kind={action.kind}
        data-tip={action.description}
        onPointerEnter={() => onPreview(lines)}
        onPointerLeave={() => onPreview(null)}
        onClick={() => onDiscard(lines)}
      >
        {action.kind === 'remove' ? <X size={12} strokeWidth={2.25} /> : <Undo2 size={12} strokeWidth={2.25} />}
        {action.label}
        <Kbd keys={hotkey('discardLines')} />
      </button>
      <button type="button" className={styles.clear} aria-label="Clear the picked lines" data-tip="Clear the picked lines" data-tip-shortcut={hotkey('clearPickedLines')} onClick={onClear}>
        <X size={12} />
      </button>
    </div>
  );
}

/**
 * Where the bar goes, in the container's scrolled content: below the number of the last picked line on the side the
 * lines are on (the modified side, for both), so it sits at the middle seam side by side. Pierre marks picked rows
 * `data-selected-line`.
 */
function useLastPickedRow(containerRef: RefObject<HTMLElement | null>, lines: ChangedLine[]): { top: number; left: number } | null {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const root = container?.querySelector('diffs-container')?.shadowRoot;
    if (!container || !root || lines.length === 0) {
      setPosition(null);
      return;
    }
    const place = (): void => {
      const side = lines.every((line) => line.side === 'deletions') ? '[data-deletions],[data-unified]' : '[data-additions],[data-unified]';
      const cells = [...root.querySelectorAll<HTMLElement>('[data-column-number][data-selected-line]')];
      const cell = cells.findLast((candidate) => candidate.closest(side)) ?? cells.at(-1);
      if (!cell) return setPosition(null);
      const view = container.getBoundingClientRect();
      const box = cell.getBoundingClientRect();
      setPosition({ top: box.bottom - view.top + container.scrollTop + 2, left: box.left - view.left + container.scrollLeft + 2 });
    };
    place();
    const resize = new ResizeObserver(place);
    resize.observe(container);
    return () => resize.disconnect();
  }, [containerRef, lines]);

  return position;
}
