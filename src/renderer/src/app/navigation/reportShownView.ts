import { api } from '../../api/client';
import { useNavigation } from './navigationStore';

/**
 * Tells the main process each view the window goes to (`windows.viewShown`), so restarting to install an update opens
 * the window on it again. Only changes: the main process already knows the view a window starts on (Changes, or the
 * one it reopened on). Returns the unsubscribe.
 */
export function reportShownView(): () => void {
  return useNavigation.subscribe((state, previous) => {
    if (state.view !== previous.view) void api.windows.viewShown(state.view);
  });
}
