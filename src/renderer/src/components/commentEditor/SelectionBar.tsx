import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { FormatCommandId } from './formatCommands';
import { FORMAT_ACTIONS, startsBlocks } from './formatActions';
import { FormatButton } from './FormatButton';
import { selectionBarPosition, type Box } from './popupPosition';
import styles from './SelectionBar.module.css';

interface SelectionBarProps {
  formats: readonly FormatCommandId[];
  active: ReadonlySet<FormatCommandId>;
  /** The selection, which the bar sits over. */
  anchor: Box;
  onFormat: (format: FormatCommandId) => void;
}

/**
 * The formats, over the text selected (`selectionBarShows`): each its key in its tooltip, on while the selection is
 * in it, a click toggling it, the caret staying in the field.
 */
export function SelectionBar({ formats, active, anchor, onFormat }: SelectionBarProps) {
  const bar = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!bar.current) return;
    setPosition(selectionBarPosition(anchor, { width: bar.current.offsetWidth, height: bar.current.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }));
  }, [anchor.left, anchor.right, anchor.top, anchor.bottom]);

  const style: CSSProperties = position ?? { left: anchor.left, top: anchor.top, visibility: 'hidden' };
  const shown = FORMAT_ACTIONS.filter((action) => formats.includes(action.id));
  return createPortal(
    <div ref={bar} className={styles.bar} role="toolbar" aria-label="Format" style={style} onMouseDown={(event) => event.preventDefault()}>
      {shown.map((action) => (
        <FormatButton key={action.id} action={action} pressed={active.has(action.id)} startsBlocks={startsBlocks(shown, action.id)} onPress={() => onFormat(action.id)} />
      ))}
    </div>,
    document.body,
  );
}
