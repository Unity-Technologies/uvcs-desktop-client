import { useContext, useEffect, useRef } from 'react';
import { windowShortcutMayRun } from './modalDialog';
import { matchesShortcut } from './shortcuts';
import { useKeymap } from './keymapStore';
import { keyTakenByText } from './textEntry';
import { PlaceCoveredContext } from './placeCovered';
import { ViewShownContext } from './viewShown';

/**
 * Runs `handler` when `shortcut` is pressed anywhere in the window, unless `enabled` is false, a modal dialog is open,
 * the view it's in is kept mounted but hidden (`ViewShownContext`), or the sign-in screen covers it
 * (`PlaceCoveredContext`); with `whileTyping` false, not in a text field
 * either, where the keys edit the text (`keyTakenByText`). Its caller renders again when a person changes a shortcut
 * (`useKeymap`), so a `hotkey()` it passes binds the new key.
 */
export function useShortcut(shortcut: string | undefined, handler: () => void, enabled = true, { whileTyping = true }: { whileTyping?: boolean } = {}): void {
  useKeymap();
  const latestHandler = useRef(handler);
  latestHandler.current = handler;
  const latestWhileTyping = useRef(whileTyping);
  latestWhileTyping.current = whileTyping;
  // Read on every render, whatever `enabled` is: a hook skipped by `&&` changes the order React keeps hooks in.
  const viewShown = useContext(ViewShownContext);
  const covered = useContext(PlaceCoveredContext);
  const listens = enabled && viewShown && !covered;

  useEffect(() => {
    if (!shortcut || !listens) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      if (!matchesShortcut(event, shortcut) || !windowShortcutMayRun(event)) return;
      if (!latestWhileTyping.current && keyTakenByText(event)) return;
      event.preventDefault();
      latestHandler.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcut, listens]);
}
