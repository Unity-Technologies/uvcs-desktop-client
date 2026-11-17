/**
 * What a person does to move a diff themselves: the wheel or trackpad, a touch, a press (the scrollbar, the change
 * map), a key. Something settling into place there (`placementStep`) stops at the first of them, so it never pulls
 * the view back from where the user takes it. It can't tell the user's scrolls from Pierre's own by the scroll position:
 * Pierre also moves it as it measures the rows it renders, which a settling placement must follow.
 */
const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

/** Calls `stop` the first time the user moves `element` themselves; returns a function that stops listening. */
export function stopOnUserScroll(element: EventTarget, stop: () => void): () => void {
  const onInput = (): void => {
    removeListeners();
    stop();
  };
  const removeListeners = (): void => USER_SCROLL_EVENTS.forEach((type) => element.removeEventListener(type, onInput));
  USER_SCROLL_EVENTS.forEach((type) => element.addEventListener(type, onInput, { passive: true }));
  return removeListeners;
}
