/** The mouse's back and forward buttons, as the page gets them (`MouseEvent.button`). */
export const MOUSE_BACK = 3;
export const MOUSE_FORWARD = 4;

/** Presses closer than this are one: on Windows a back button can reach the page both as a button and as an app command. */
const SAME_PRESS_MS = 150;

/** `goBack`, run once per press however many ways the press arrives. */
export function oncePerPress(goBack: () => void, now: () => number = Date.now): () => void {
  let last = -Infinity;
  return () => {
    const at = now();
    if (at - last < SAME_PRESS_MS) return;
    last = at;
    goBack();
  };
}
