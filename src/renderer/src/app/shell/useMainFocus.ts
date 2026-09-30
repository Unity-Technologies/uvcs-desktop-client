import { useEffect, type RefObject } from 'react';
import { focusMain, isKeyboardTaken } from '../../lib/mainFocus';
import { useNavigation } from '../navigation/navigationStore';
import { isAimedAtMainList } from './mainFocusKeys';

/** How long a view may take to show its list (loading lazily, then its data) before focus stops waiting for it. */
const WAIT_MS = 5000;

/**
 * Keyboard-first focus for the workspace screen: the main list of the view or page on top (see `MAIN_FOCUS`) takes
 * focus when the workspace opens, after ⌘1…, a sidebar click, opening a page or going back, and whenever focus falls
 * to the document (a dialog, menu or popover closed, the focused row went away). A list key pressed while nothing has
 * focus is handed to the list. Waiting for a view to load gives up as soon as the user clicks or focuses something.
 */
export function useMainFocus(contentRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    let stopWaiting = (): void => {};

    const focusSoon = (): void => {
      stopWaiting();
      const root = contentRef.current;
      if (!root) return;
      const observer = new MutationObserver(() => attempt());
      const stop = (): void => {
        observer.disconnect();
        clearTimeout(timeout);
        cancelAnimationFrame(frame);
        window.removeEventListener('pointerdown', stop, true);
        window.removeEventListener('focusin', onFocusIn, true);
      };
      // Focus the user (or a view's own autofocus) put somewhere stays there.
      const onFocusIn = (event: FocusEvent): void => {
        if (!root.contains(event.target as Node) || !(event.target as HTMLElement).hasAttribute('data-main-focus')) stop();
      };
      const attempt = (): void => {
        if (isKeyboardTaken()) return stop();
        if (focusMain(root)) stop();
      };
      const frame = requestAnimationFrame(attempt);
      const timeout = setTimeout(stop, WAIT_MS);
      observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
      window.addEventListener('pointerdown', stop, true);
      window.addEventListener('focusin', onFocusIn, true);
      stopWaiting = stop;
    };

    const focusIfLost = (): void => {
      requestAnimationFrame(() => {
        const root = contentRef.current;
        if (root && document.activeElement === document.body && document.hasFocus() && !isKeyboardTaken()) focusMain(root);
      });
    };

    const onKeyDownCapture = (event: KeyboardEvent): void => {
      const root = contentRef.current;
      if (!root || document.activeElement !== document.body || !isAimedAtMainList(event)) return;
      if (isKeyboardTaken() || !focusMain(root)) return;
      // The key was aimed at the list: it gets it now that it has focus.
      event.preventDefault();
      event.stopPropagation();
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', event));
    };

    // Dialogs, menus and popovers live in portals on the body: when one goes away, focus may be left nowhere.
    const portals = new MutationObserver((mutations) => {
      if (mutations.some((mutation) => mutation.removedNodes.length > 0)) focusIfLost();
    });
    portals.observe(document.body, { childList: true });

    const unsubscribe = useNavigation.subscribe((state, previous) => {
      if (state.view !== previous.view || state.pages !== previous.pages) focusSoon();
    });
    window.addEventListener('keydown', onKeyDownCapture, true);
    focusSoon();

    return () => {
      stopWaiting();
      unsubscribe();
      portals.disconnect();
      window.removeEventListener('keydown', onKeyDownCapture, true);
    };
  }, [contentRef]);
}
