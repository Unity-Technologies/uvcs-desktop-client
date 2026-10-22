import { Link } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';
import type { ChangedLine } from './changeBlocks';
import { chipTop } from './chipPlacement';
import { lineNumberCellSelector, type CodeLayout } from './lineActions';
import { paneRect, pierreShadowRoot } from './pierreDom';
import styles from './LineLinkChip.module.css';

interface LineLinkChipProps {
  /** The scrolling element around the code, which the chip is placed in. */
  containerRef: RefObject<HTMLElement | null>;
  /** The first line selected (`lineChipAnchor`). */
  line: ChangedLine;
  layout: CodeLayout;
  /** What it copies, for its tooltip: "Copy link to lines 40–52 of Player.cs". */
  label: string;
  shortcut: string;
  onCopy: () => void;
}

const CHIP_HEIGHT = 20;
/** The room between the chip and the right edge of its pane. */
const CHIP_INSET = 8;
/** Frames to wait for the line's row to render. */
const MAX_FRAMES = 60;

/**
 * "Copy link" by the lines selected: on the top edge of the first, at the right end of its pane, as a change's
 * "Revert change" chip sits (`ChangeChip`), so what selecting lines is for shows where they were selected.
 */
export function LineLinkChip({ containerRef, line, layout, label, shortcut, onCopy }: LineLinkChipProps) {
  const position = useChipPosition(containerRef, line, layout);
  if (!position) return null;
  return (
    <button type="button" className={styles.chip} style={position} data-tip={label} data-tip-shortcut={shortcut} onClick={onCopy}>
      <Link size={12} strokeWidth={2.25} />
      Copy link
    </button>
  );
}

/**
 * Where the chip goes, in the container's scrolled content; none while the line's row isn't rendered (a big file
 * renders only the lines in view), placed again as the view scrolls or resizes.
 */
function useChipPosition(containerRef: RefObject<HTMLElement | null>, line: ChangedLine, layout: CodeLayout): { top: number; left: number } | null {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const { side, lineNumber } = line;

  // After the commit, not in a layout effect: the chip is inside the container, whose ref is set after its children's
  // layout effects run.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return setPosition(null);
    /** Places the chip by the line's number; false while its row isn't rendered. */
    const place = (): boolean => {
      const cell = pierreShadowRoot(container)?.querySelector(lineNumberCellSelector({ side, lineNumber }, layout));
      const pane = cell?.closest('[data-code]');
      if (!cell || !pane) {
        setPosition((last) => (last === null ? last : null));
        return false;
      }
      const view = container.getBoundingClientRect();
      const rect = cell.getBoundingClientRect();
      const top = chipTop(rect.top - view.top + container.scrollTop, rect.bottom - view.top + container.scrollTop, CHIP_HEIGHT);
      const left = paneRect(pane).right - view.left + container.scrollLeft - CHIP_INSET;
      setPosition((last) => (last && last.top === top && last.left === left ? last : { top, left }));
      return true;
    };
    // The code may not be rendered yet (it highlights, or scrolls to a link's lines): look again for a moment.
    let frames = 0;
    let frame = 0;
    const placeSoon = (): void => {
      if (!place() && ++frames < MAX_FRAMES) frame = requestAnimationFrame(placeSoon);
    };
    placeSoon();
    const resize = new ResizeObserver(() => void place());
    resize.observe(container);
    const placeAgain = (): void => void place();
    container.addEventListener('scroll', placeAgain, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      container.removeEventListener('scroll', placeAgain);
    };
  }, [containerRef, side, lineNumber, layout]);

  return position;
}
