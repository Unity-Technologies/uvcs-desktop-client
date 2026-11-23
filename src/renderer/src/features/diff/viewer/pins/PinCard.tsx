import type { ReactNode } from 'react';
import type { Size } from '../image/composedFrame';
import { cardPlacement, pinBounds, type ScreenRect } from './pinPlacement';
import styles from './CommentPins.module.css';

/** A card's width beside its pin: a thread reads as it does under a line of code, at a reading width. */
const CARD_WIDTH = 360;

/** The width the stage's floating controls take at the viewport's right edge, with their margin. */
const STAGE_CONTROLS_ROOM = 52;

/** The opened pin's card, beside it and within the viewport, scrolling inside when taller than the room. */
export function PinCard({ rect, viewport, children }: { rect: ScreenRect; viewport: Size; children: ReactNode }) {
  // The stage's controls float at the right edge (`StageControls`): a card never goes under them.
  const placement = cardPlacement(pinBounds(rect), { width: viewport.width - STAGE_CONTROLS_ROOM, height: viewport.height }, CARD_WIDTH);
  return (
    <div className={styles.card} data-no-pan="" style={{ ...placement, width: CARD_WIDTH }}>
      {children}
    </div>
  );
}
