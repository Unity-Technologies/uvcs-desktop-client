// Shows or hides a comment's card over an image or a 3D model while its pin is out of view, kept mounted so what's
// written in it stays (`stageCardPlacement`, the model's projector).

/**
 * Hides the card (`data-off-screen`, styled by the layer it's in) or shows it again. One hidden while it holds the
 * focus hands it to `stage`, the viewer's focusable pane: a hidden card can't take keys, and the stage's own (zoom, C)
 * keep working.
 */
export function setCardHidden(card: HTMLElement, hidden: boolean, stage: HTMLElement | null): void {
  if (hidden && card.contains(document.activeElement)) stage?.focus({ preventScroll: true });
  card.toggleAttribute('data-off-screen', hidden);
}
