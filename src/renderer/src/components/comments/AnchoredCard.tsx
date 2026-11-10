import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { hoverCardPosition } from './hoverCardPosition';
import { hoverStep, type HoverEvent } from '../../lib/hoverOpening';
import styles from './AnchoredCard.module.css';

/** The handlers a card that scrolls takes (`AnchoredCard`'s `scrollWith`): over it, it stays, a press in it too. */
export interface CardPointerHandlers {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

/**
 * Whether a hover card shows (`hoverStep`): the handlers go on the anchor, and a card that scrolls (`scrollable`: a
 * long text) takes `cardHandlers`.
 */
export function useHoverOpen({ scrollable = false }: { scrollable?: boolean } = {}) {
  const [open, setOpen] = useState(false);
  const timer = useRef<number>(undefined);
  const overCard = useRef(false);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const on = (event: HoverEvent): void => {
    window.clearTimeout(timer.current);
    const step = hoverStep(event, { scrollable, overCard: overCard.current });
    if ('keep' in step) return;
    if (step.afterMs === 0) setOpen(step.open);
    else timer.current = window.setTimeout(() => setOpen(step.open), step.afterMs);
  };
  const cardHandlers: CardPointerHandlers = {
    onMouseEnter: () => {
      overCard.current = true;
      on('enterCard');
    },
    onMouseLeave: () => {
      overCard.current = false;
      on('leaveCard');
    },
  };
  return {
    open,
    /** Closes it now, as a click on its anchor that opens what the card previews. */
    hide: () => {
      window.clearTimeout(timer.current);
      setOpen(false);
    },
    cardHandlers,
    handlers: {
      onMouseEnter: () => on('enterAnchor'),
      onMouseLeave: () => on('leaveAnchor'),
      onFocus: () => on('focus'),
      onBlur: () => on('blur'),
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
      // A card that scrolls takes the pointer, and its links a press: it isn't hidden from assistive technology.
      aria-hidden={scrollWith === undefined}
      data-scrolls={scrollWith !== undefined}
      {...scrollWith}
    >
      {children}
    </div>,
    document.body,
  );
}
