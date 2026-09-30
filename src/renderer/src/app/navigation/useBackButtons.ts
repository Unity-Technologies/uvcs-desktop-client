import { useEffect, useRef } from 'react';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { MOUSE_BACK, MOUSE_FORWARD, oncePerPress } from '../../lib/backButtons';
import { isModalDialogOpen } from '../../lib/modalDialog';

/**
 * Runs `goBack` on the mouse's back button (Linux and macOS send it to the page; Windows as an app command too) and on
 * a keyboard's Browser Back key (Windows), unless a modal dialog is open. There is nothing to go forward to: the forward
 * button does nothing.
 */
export function useBackButtons(goBack: () => void): void {
  const latest = useRef(goBack);
  latest.current = goBack;
  const back = useRef(oncePerPress(() => !isModalDialogOpen() && latest.current()));

  useEffect(() => {
    const onMouseUp = (event: MouseEvent): void => {
      if (event.button !== MOUSE_BACK && event.button !== MOUSE_FORWARD) return;
      event.preventDefault();
      if (event.button === MOUSE_BACK) back.current();
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);
  useUvcsEvent('navigateBack', () => back.current());
}
