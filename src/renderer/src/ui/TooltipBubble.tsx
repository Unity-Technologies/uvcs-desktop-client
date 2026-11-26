import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PathMove } from './followTip';
import { Kbd } from './Kbd';
import { PathMoveLines } from './PathMoveLines';
import styles from './TooltipLayer.module.css';
import { placeTooltip, type TooltipPlacement, type TooltipSide } from './tooltipPlacement';

interface TooltipBubbleProps {
  text: string;
  /** Dimmed second line. */
  sub?: string;
  /** Shortcut shown as key caps. */
  shortcut?: string;
  /** A moved item's two paths, under the text, what changed marked in each. */
  move?: PathMove;
  /** Where the pointer was when it showed, in client coordinates: the bubble is anchored to the cursor. */
  pointerX: number;
  pointerY: number;
  /** Room for a paragraph (a whole comment) rather than a label. */
  wide?: boolean;
  /** The element it's about, to sit on (`side`) instead of by the cursor: a comment's pin. */
  element?: DOMRectReadOnly;
  /** The side of its anchor it opens on when it fits (`placeTooltip`). */
  side?: TooltipSide;
}

/** The look of the app's tooltips: a small plain bubble by the cursor (or on the element it's about), its caret pointing at it. It never takes the pointer. */
export function TooltipBubble({ text, sub, shortcut, move, pointerX, pointerY, wide = false, element, side }: TooltipBubbleProps) {
  const [placement, setPlacement] = useState<TooltipPlacement | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  // Placed again whenever its size changes after it showed (a move's lines fitted to it, `PathMoveLines`).
  useLayoutEffect(() => {
    const tooltip = tipRef.current;
    if (!tooltip) return;
    const place = (): void => {
      // Its laid-out size, not its box on screen, which the pop-in animation scales down while it runs.
      const bubble = { width: tooltip.offsetWidth, height: tooltip.offsetHeight };
      const anchor = element ? { element } : { pointer: { x: pointerX, y: pointerY } };
      setPlacement(placeTooltip(anchor, bubble, { width: window.innerWidth, height: window.innerHeight }, side));
    };
    place();
    const resizes = new ResizeObserver(place);
    resizes.observe(tooltip);
    return () => resizes.disconnect();
  }, [text, sub, shortcut, move, pointerX, pointerY, element, side]);

  return createPortal(
    <div
      ref={tipRef}
      className={styles.tooltip}
      data-side={placement?.side}
      data-wide={wide || undefined}
      data-move={move !== undefined || undefined}
      role="tooltip"
      style={placement ? { top: placement.top, left: placement.left } : { top: -9999, left: -9999 }}
    >
      {(text || shortcut) && (
        <div className={styles.main}>
          <span>{text}</span>
          {shortcut && <Kbd keys={shortcut} />}
        </div>
      )}
      {move && <PathMoveLines move={move} />}
      {sub && <div className={styles.sub}>{sub}</div>}
      {placement && <span className={styles.arrow} style={{ left: placement.arrowX - 5 }} />}
    </div>,
    document.body,
  );
}
