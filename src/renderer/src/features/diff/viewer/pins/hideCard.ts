// Shows or hides a comment's card over an image or a 3D model while its pin is out of view, kept mounted so what's
// written in it stays (`stageCardPlacement`, the model's projector).

import { focusLeavesHiddenCard } from './pinPlacement';

/**
 * Hides the card (`data-off-screen`, styled by the layer it's in) or shows it again; one hidden while it holds the
 * focus hands it to the stage it's on, the nearest focusable ancestor (`focusLeavesHiddenCard`).
 */
export function setCardHidden(card: HTMLElement, hidden: boolean): void {
  if (focusLeavesHiddenCard(hidden, card.contains(document.activeElement))) {
    card.parentElement?.closest<HTMLElement>('[tabindex="0"]')?.focus({ preventScroll: true });
  }
  card.toggleAttribute('data-off-screen', hidden);
}
