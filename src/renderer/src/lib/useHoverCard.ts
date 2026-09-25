import { useEffect, useRef, useState } from 'react';

const OPEN_DELAY_MS = 350;
const CLOSE_DELAY_MS = 200;

/**
 * A popover that opens while its trigger is hovered and stays open while the pointer moves onto it.
 * Clicking the trigger pins it open (and lets it take focus, for the keyboard); clicking outside or Escape closes it.
 */
export function useHoverCard() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const later = (action: () => void, delay: number): void => {
    clearTimeout(timer.current);
    timer.current = setTimeout(action, delay);
  };
  const close = (): void => {
    clearTimeout(timer.current);
    setPinned(false);
    setOpen(false);
  };
  const pin = (): void => {
    clearTimeout(timer.current);
    setPinned(true);
    setOpen(true);
  };

  return {
    open,
    pinned,
    close,
    /** Clicking the trigger: pins a card opened by hovering, closes a pinned one. */
    toggle: () => (open && pinned ? close() : pin()),
    /** For Radix `onOpenChange`: outside clicks and Escape. */
    onOpenChange: (next: boolean) => (next ? pin() : close()),
    /** Spread on both the trigger and the card. */
    hoverProps: {
      onMouseEnter: () => later(() => setOpen(true), open ? 0 : OPEN_DELAY_MS),
      onMouseLeave: () => {
        if (!pinned) later(() => setOpen(false), CLOSE_DELAY_MS);
      },
    },
  };
}
