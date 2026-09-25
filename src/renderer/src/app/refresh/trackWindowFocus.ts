import { focusManager } from '@tanstack/react-query';

/**
 * Tells TanStack Query when the user is in the app. Its default only listens to `visibilitychange`, but an Electron
 * window stays visible behind other apps, so coming back from the editor or terminal never counted as a focus and
 * `refetchOnWindowFocus` did nothing. Blurred or hidden counts as away.
 */
export function trackWindowFocus(): void {
  focusManager.setEventListener((setFocused) => {
    const update = () => setFocused(document.visibilityState === 'visible' && document.hasFocus());
    window.addEventListener('focus', update);
    window.addEventListener('blur', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.removeEventListener('focus', update);
      window.removeEventListener('blur', update);
      document.removeEventListener('visibilitychange', update);
    };
  });
}
