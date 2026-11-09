/**
 * Whether the Timeline slides in, after `shown` changed from `shownBefore` (or didn't) while it was `sliding`: a toggle
 * that shows it starts the slide, one that hides it ends it, and otherwise it goes on until the slide is over
 * (`slidIn`). So it slides only when the user shows it, never when the view opens with it shown or the graph's pane
 * mounts it again (a range with nothing to draw, then one with history).
 */
export function slidesIn(shownBefore: boolean, shown: boolean, sliding: boolean): boolean {
  return shown === shownBefore ? sliding : shown;
}
