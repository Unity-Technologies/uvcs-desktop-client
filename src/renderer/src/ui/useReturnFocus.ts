import { useRef } from 'react';
import { focusAfterMenu } from './menu/focusAfterMenu';

/**
 * For a Radix popover opened from anywhere (a shortcut, the palette): closing gives focus back to what had it when
 * it opened, such as the list the keyboard was on, rather than to its trigger button. Spread on `Popover.Content`.
 */
export function useReturnFocus(open: boolean): { onCloseAutoFocus: (event: Event) => void } {
  const previous = useRef<Element | null>(null);
  const wasOpen = useRef(false);
  // Read while rendering the opening, before an autofocused field inside the popover takes focus.
  if (open && !wasOpen.current) previous.current = document.activeElement;
  wasOpen.current = open;

  return {
    onCloseAutoFocus: (event) =>
      focusAfterMenu(event, () => {
        const element = previous.current;
        if (!(element instanceof HTMLElement) || element === document.body || !element.isConnected) return;
        event.preventDefault();
        element.focus({ preventScroll: true });
      }),
  };
}
