import { Link } from 'lucide-react';
import type { RefObject } from 'react';
import type { ChangedLine } from './changeBlocks';
import { chipTop } from './chipPlacement';
import type { CodeLayout } from './lineActions';
import { useLineBoxes } from './useLineBoxes';
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

/**
 * "Copy link" by the lines selected: on the top edge of the first, at the right end of its pane, as a change's
 * "Revert change" chip sits (`ChangeChip`), so what selecting lines is for shows where they were selected.
 */
export function LineLinkChip({ containerRef, line, layout, label, shortcut, onCopy }: LineLinkChipProps) {
  const key = `${line.side}:${line.lineNumber}`;
  const boxes = useLineBoxes(containerRef, [{ ...line, key }], key, layout);
  const box = boxes.get(key);
  if (!box) return null;
  const position = { top: chipTop(box.top, box.bottom, CHIP_HEIGHT), left: box.paneRight - CHIP_INSET };
  return (
    <button type="button" className={styles.chip} style={position} data-tip={label} data-tip-shortcut={shortcut} onClick={onCopy}>
      <Link size={12} strokeWidth={2.25} />
      Copy link
    </button>
  );
}
