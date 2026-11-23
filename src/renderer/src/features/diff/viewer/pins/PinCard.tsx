import type { ReactNode } from 'react';
import type { Size } from '../image/composedFrame';
import { pinCardPlacement, PIN_CARD_WIDTH, type ScreenRect } from './pinPlacement';
import styles from './CommentPins.module.css';

/** The opened pin's card, beside it and within the viewport, scrolling inside when taller than the room. */
export function PinCard({ rect, viewport, children }: { rect: ScreenRect; viewport: Size; children: ReactNode }) {
  return (
    <div className={styles.card} data-no-pan="" style={{ ...pinCardPlacement(rect, viewport), width: PIN_CARD_WIDTH }}>
      {children}
    </div>
  );
}
