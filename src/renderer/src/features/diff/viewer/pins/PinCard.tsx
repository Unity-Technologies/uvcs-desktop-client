import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { setCardHidden } from './hideCard';
import { cardStyleOf, stageCardPlacement, type ScreenRect } from './pinPlacement';
import styles from './CommentPins.module.css';

interface PinCardProps {
  /** Where the pin's spot shows in its pane. */
  rect: ScreenRect;
  /** The pane the pin shows in: Split's half, or the whole stage. */
  pane: HTMLElement | null;
  /** The layer over the whole stage the card shows in, clear of the panes' edges. */
  layer: HTMLElement | null;
  children: ReactNode;
}

/**
 * The opened pin's card, beside it and within the stage, scrolling inside when taller than the room; hidden while its
 * pin is out of view. It's placed after each render from where its pane sits on the stage (`stageCardPlacement`),
 * which only the page knows.
 */
export function PinCard({ rect, pane, layer, children }: PinCardProps) {
  const card = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!card.current || !pane || !layer) return;
    const paneBox = pane.getBoundingClientRect();
    const layerBox = layer.getBoundingClientRect();
    const onStage = { x: paneBox.left - layerBox.left, y: paneBox.top - layerBox.top, width: paneBox.width, height: paneBox.height };
    const placement = stageCardPlacement(rect, onStage, { width: layer.clientWidth, height: layer.clientHeight });
    // Hidden, never unmounted, while its pin is out of view: a reply being written in it stays.
    setCardHidden(card.current, placement === null);
    if (placement) Object.assign(card.current.style, cardStyleOf(placement));
  });
  if (!layer) return null;
  return createPortal(
    <div ref={card} className={styles.card} data-no-pan="">
      {children}
    </div>,
    layer,
  );
}
