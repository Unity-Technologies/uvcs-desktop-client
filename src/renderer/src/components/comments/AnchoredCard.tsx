import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { hoverCardPosition } from './hoverCardPosition';
import styles from './AnchoredCard.module.css';

/** How long the pointer rests on a chip before its card shows. */
const HOVER_DELAY_MS = 350;

/**
 * Whether a hover card shows: after the pointer rests on its anchor, at once on keyboard focus, gone as either
 * leaves. The handlers go on the anchor.
 */
export function useHoverOpen() {
  const [open, setOpen] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const hide = (): void => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };
  return {
    open,
    handlers: {
      onMouseEnter: () => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setOpen(true), HOVER_DELAY_MS);
      },
      onMouseLeave: hide,
      onFocus: () => setOpen(true),
      onBlur: hide,
    },
  };
}

interface AnchoredCardProps {
  anchor: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * A card by its anchor (`hoverCardPosition`), as the app's tooltips are: it takes no keys and no focus, so Esc still
 * closes the dialog around it, and the pointer passes through. Mounted only while it shows: a chip costs nothing more.
 */
export function AnchoredCard({ anchor, children }: AnchoredCardProps) {
  const card = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const box = anchor.current?.getBoundingClientRect();
    if (!box || !card.current) return;
    setPosition(hoverCardPosition(box, { width: card.current.offsetWidth, height: card.current.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }));
  }, [anchor]);
  const style: CSSProperties = position ?? { left: 0, top: 0, visibility: 'hidden' };
  return createPortal(
    <div ref={card} className={styles.card} style={style} aria-hidden>
      {children}
    </div>,
    document.body,
  );
}
