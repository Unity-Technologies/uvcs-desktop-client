import { useEffect, useRef } from 'react';
import { windowShortcutMayRun } from './modalDialog';
import { matchesShortcut } from './shortcuts';
import { keyTakenByText } from './textEntry';

/**
 * Runs `handler` when `shortcut` is pressed anywhere in the window, unless `enabled` is false or a modal dialog is open;
 * with `whileTyping` false, not in a text field either, where the keys edit the text (`keyTakenByText`).
 */
export function useShortcut(shortcut: string | undefined, handler: () => void, enabled = true, { whileTyping = true }: { whileTyping?: boolean } = {}): void {
  const latestHandler = useRef(handler);
  latestHandler.current = handler;
  const latestWhileTyping = useRef(whileTyping);
  latestWhileTyping.current = whileTyping;

  useEffect(() => {
    if (!shortcut || !enabled) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (!matchesShortcut(event, shortcut) || !windowShortcutMayRun(event)) return;
      if (!latestWhileTyping.current && keyTakenByText(event)) return;
      event.preventDefault();
      latestHandler.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcut, enabled]);
}
