import { afterLeaving } from '../navigation/leaveGuard';
import { useNavigation } from '../navigation/navigationStore';

/** Back in a page window: to the page it came from within it, never past the page it opened on. */
export function pageWindowGoBack(): void {
  if (useNavigation.getState().pages.length > 1) afterLeaving(() => useNavigation.getState().goBack());
}
