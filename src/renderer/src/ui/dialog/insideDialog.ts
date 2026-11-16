import { createContext, useContext } from 'react';

/**
 * Whether a piece is drawn inside one of the app's modal dialogs (`Dialog`, `CardDialog`). A modal dialog takes the
 * mouse wheel from everything outside it, and a popover is drawn outside, at the page's end: a popover opened from a
 * dialog is modal itself, so its own list scrolls (`Popover`).
 */
export const InsideDialog = createContext(false);

export function useInsideDialog(): boolean {
  return useContext(InsideDialog);
}
