import { useEffect, useRef } from 'react';
import { matchesShortcut } from './shortcuts';

/** Runs `handler` when `shortcut` is pressed anywhere in the window, unless `enabled` is false. */
export function useShortcut(shortcut: string | undefined, handler: () => void, enabled = true): void {
  const latestHandler = useRef(handler);
  latestHandler.current = handler;

  useEffect(() => {
    if (!shortcut || !enabled) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (!matchesShortcut(event, shortcut)) return;
      event.preventDefault();
      latestHandler.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcut, enabled]);
}
