import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Kbd } from './Kbd';
import styles from './TooltipLayer.module.css';

interface TooltipBubbleProps {
  text: string;
  /** Dimmed second line. */
  sub?: string;
  /** Shortcut shown as key caps. */
  shortcut?: string;
  /** Where the pointer was when it showed, in client coordinates: the bubble is anchored to the cursor. */
  pointerX: number;
  pointerY: number;
  /** Room for a paragraph (a whole comment) rather than a label. */
  wide?: boolean;
}

interface Placement {
  top: number;
  left: number;
  side: 'above' | 'below';
  arrowX: number;
}

/** The look of the app's tooltips: a small plain bubble by the cursor, its caret pointing at it. It never takes the pointer. */
export function TooltipBubble({ text, sub, shortcut, pointerX, pointerY, wide = false }: TooltipBubbleProps) {
  const [placement, setPlacement] = useState<Placement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  // Just below the cursor, flipping above near the bottom edge. The bubble starts a little left of the cursor and
  // shifts to stay on screen, while its caret keeps pointing at the cursor.
  useLayoutEffect(() => {
    if (!tipRef.current) return;
    const bubble = tipRef.current.getBoundingClientRect();
    const margin = 8;
    const gap = 18;
    const arrowInset = 18;

    let side: Placement['side'] = 'below';
    let top = pointerY + gap;
    if (top + bubble.height > window.innerHeight - margin) {
      side = 'above';
      top = pointerY - gap - bubble.height;
    }
    top = Math.max(margin, Math.min(top, window.innerHeight - bubble.height - margin));
    const left = Math.max(margin, Math.min(pointerX - arrowInset, window.innerWidth - bubble.width - margin));
    const arrowX = Math.max(14, Math.min(pointerX - left, bubble.width - 14));
    setPlacement({ top, left, side, arrowX });
  }, [text, sub, shortcut, pointerX, pointerY]);

  return createPortal(
    <div
      ref={tipRef}
      className={styles.tooltip}
      data-side={placement?.side}
      data-wide={wide || undefined}
      role="tooltip"
      style={placement ? { top: placement.top, left: placement.left } : { top: -9999, left: -9999 }}
    >
      <div className={styles.main}>
        <span>{text}</span>
        {shortcut && <Kbd keys={shortcut} />}
      </div>
      {sub && <div className={styles.sub}>{sub}</div>}
      {placement && <span className={styles.arrow} style={{ left: placement.arrowX - 5 }} />}
    </div>,
    document.body,
  );
}
