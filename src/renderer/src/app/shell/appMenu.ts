import { useEffect } from 'react';
import { api } from '../../api/client';
import { isMac, WINDOW_CHROME } from '../../lib/platform';
import { hotkeys } from '../../lib/shortcutRegistry';
import { useShortcut } from '../../lib/useShortcut';
import { AltTap } from './altTap';

export const APP_MENU_BUTTON = 'data-app-menu-button';

/** Opens the menu bar's menus under the window's menu button, or at the page's top-left corner without one. */
export function showAppMenu(): void {
  const button = document.querySelector(`[${APP_MENU_BUTTON}]`)?.getBoundingClientRect();
  void api.windows.showAppMenu(button ? { x: button.left, y: button.bottom } : { x: 0, y: 0 });
}

/**
 * F10 opens the menus off macOS, and so does tapping Alt where the window has no menu bar to take it (Windows);
 * a Linux window's menu bar takes Alt itself.
 */
export function useAppMenuKeys(): void {
  useShortcut(hotkeys('appMenu')[0], showAppMenu, !isMac);

  useEffect(() => {
    if (WINDOW_CHROME !== 'overlay') return;
    const tap = new AltTap();
    const onKeyDown = (event: KeyboardEvent): void => tap.keyDown(event);
    const onKeyUp = (event: KeyboardEvent): void => {
      if (!tap.keyUp(event)) return;
      event.preventDefault();
      showAppMenu();
    };
    const cancel = (): void => tap.cancel();
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('pointerdown', cancel, true);
    window.addEventListener('blur', cancel);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('pointerdown', cancel, true);
      window.removeEventListener('blur', cancel);
    };
  }, []);
}
