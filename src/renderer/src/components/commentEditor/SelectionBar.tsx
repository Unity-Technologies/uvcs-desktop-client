import { Bold, Code, Italic, Link, List, ListTodo, SquareCode, Strikethrough, TextQuote, type LucideIcon } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { hotkey } from '../../lib/shortcutRegistry';
import type { FormatCommandId } from './formatCommands';
import { FORMAT_SHORTCUTS } from './formattingKeys';
import { selectionBarPosition, type Box } from './popupPosition';
import { FORMAT_LABELS } from './selectionBarState';
import styles from './SelectionBar.module.css';

const ICONS: Record<FormatCommandId, LucideIcon> = {
  bold: Bold,
  italic: Italic,
  strikethrough: Strikethrough,
  code: Code,
  link: Link,
  bullet: List,
  task: ListTodo,
  quote: TextQuote,
  codeBlock: SquareCode,
};

/** Where the inline formats end and the blocks start: a hairline between the two groups. */
const FIRST_BLOCK: FormatCommandId = 'bullet';

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
  return createPortal(
    <div ref={bar} className={styles.bar} role="toolbar" aria-label="Format" style={style} onMouseDown={(event) => event.preventDefault()}>
      {formats.map((format) => {
        const Icon = ICONS[format];
        const shortcut = FORMAT_SHORTCUTS[format];
        return (
          <span key={format} className={styles.group} data-starts-blocks={format === FIRST_BLOCK || undefined}>
            <button
              type="button"
              className={styles.button}
              aria-label={FORMAT_LABELS[format]}
              aria-pressed={active.has(format)}
              data-tip={FORMAT_LABELS[format]}
              data-tip-shortcut={shortcut && hotkey(shortcut)}
              tabIndex={-1}
              onClick={() => onFormat(format)}
            >
              <Icon size={15} strokeWidth={2.25} aria-hidden />
            </button>
          </span>
        );
      })}
    </div>,
    document.body,
  );
}
