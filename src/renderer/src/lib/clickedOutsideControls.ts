/** What a click lands on, as far as a whole row taking the click needs to know (an `Element`'s `closest`). */
export interface ClickTarget {
  closest(selectors: string): unknown;
}

/** What does something of its own when clicked: a row taking the click leaves these to it. */
export const CONTROLS = 'button, a, input, textarea, select, label, [role="button"]';

/**
 * Whether a click on a row is the row's own: not on a control inside it (a link, a button), which does its own thing,
 * nor the end of a drag selecting its text to copy.
 */
export function clickedOutsideControls(target: ClickTarget | null, selectsText: boolean): boolean {
  return !selectsText && target !== null && target.closest(CONTROLS) === null;
}

/** Whether a click on a row is the row's own (`clickedOutsideControls`), read from the click and the page's selection. */
export function rowTakesClick(event: { target: EventTarget | null }): boolean {
  const target = event.target instanceof Element ? event.target : null;
  return clickedOutsideControls(target, window.getSelection()?.isCollapsed === false);
}
