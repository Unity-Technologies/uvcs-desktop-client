import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { hoverCardPosition } from './hoverCardPosition';
import styles from './AnchoredCard.module.css';

/** How long the pointer rests on a chip before its card shows. */
const HOVER_DELAY_MS = 350;

/** How long a card that scrolls stays once the pointer leaves its anchor: time to cross the gap onto it. */
const LEAVE_GRACE_MS = 200;

/** The handlers a card that scrolls takes (`AnchoredCard`'s `scrollWith`): over it, it stays, a press in it too. */
export interface CardPointerHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * Whether a hover card shows: after the pointer rests on its anchor, at once on keyboard focus, gone as either
 * leaves. The handlers go on the anchor. A card that scrolls (`scrollable`: a long text) stays while the pointer
 * crosses onto it and rests there, its own handlers (`cardHandlers`) on the card.
 */
export function useHoverOpen({ scrollable = false }: { scrollable?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number>(undefined);
  // A press in a card that scrolls (selecting its text) takes the anchor's focus: that blur keeps it open.
  const overCard = useRef(false);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const hide = (): void => {
    window.clearTimeout(timer.current);
    setOpen(false);
  };
  const leave = (): void => {
    if (!scrollable) return hide();
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), LEAVE_GRACE_MS);
  };
  const cardHandlers: CardPointerHandlers = {
    onMouseEnter: () => {
      overCard.current = true;
      window.clearTimeout(timer.current);
    },
    onMouseLeave: () => {
      overCard.current = false;
      leave();
    },
  };
  return {
    open,
    /** Closes it now, as a click on its anchor that opens what the card previews. */
    hide,
    cardHandlers,
    handlers: {
      onMouseEnter: () => {
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setOpen(true), HOVER_DELAY_MS);
      },
      onMouseLeave: leave,
      onFocus: () => setOpen(true),
      onBlur: () => {
        if (!overCard.current) hide();
      },
    },
  };
}

interface AnchoredCardProps {
  anchor: RefObject<HTMLElement | null>;
  children: ReactNode;
  /** A card that scrolls takes the pointer, with these handlers (`useHoverOpen`'s `cardHandlers`), to keep it open. */
  scrollWith?: CardPointerHandlers;
}

/**
 * A card by its anchor (`hoverCardPosition`), as the app's tooltips are: it takes no keys and no focus, so Esc still
 * closes the dialog around it, and the pointer passes through, but for a card that scrolls (`scrollWith`), which the
 * wheel reaches and whose text can be selected. Mounted only while it shows: a chip costs nothing more.
 */
export function AnchoredCard({ anchor, children, scrollWith }: AnchoredCardProps) {
  const card = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const box = anchor.current?.getBoundingClientRect();
    if (!box || !card.current) return;
    setPosition(hoverCardPosition(box, { width: card.current.offsetWidth, height: card.current.offsetHeight }, { width: window.innerWidth, height: window.innerHeight }));
  }, [anchor]);
  const style: CSSProperties = position ?? { left: 0, top: 0, visibility: 'hidden' };
  return createPortal(
    <div
      ref={card}
      className={styles.card}
      style={style}
      aria-hidden
      data-scrolls={scrollWith !== undefined}
      {...scrollWith}
    >
      {children}
    </div>,
    document.body,
  );
}
