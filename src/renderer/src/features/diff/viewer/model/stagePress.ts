// What a press on the model stage is, as `useOrbitGestures` takes it: a drag turns or pans, a press that stays put is
// a click.

/** A press that moves less than this, in pixels, is a click. */
export const CLICK_SLOP = 4;

/** Whether a press pans rather than turns: the right or middle button, or the left with Shift held. */
export function pressPans(button: number, shiftKey: boolean): boolean {
  return button === 1 || button === 2 || (button === 0 && shiftKey);
}

/**
 * Whether a press let go is a click: the left button, moved less than `CLICK_SLOP`, with Shift held or not. A
 * Shift-drag pans; a Shift-click while commenting marks the whole part (`stageClickOf`).
 */
export function pressIsClick(button: number, travelled: number): boolean {
  return button === 0 && travelled < CLICK_SLOP;
}
