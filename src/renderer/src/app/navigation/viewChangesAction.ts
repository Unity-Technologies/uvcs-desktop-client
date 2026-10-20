import type { ToastAction } from '../../ui/toast/toastStore';
import { navigation, useNavigation } from './navigationStore';

/** A toast's way to the pending changes an operation left: to Changes, unless it's what the window shows. */
export function viewChangesAction(): ToastAction | undefined {
  const { view, pages } = useNavigation.getState();
  return view === 'changes' && pages.length === 0 ? undefined : { label: 'View changes', run: () => navigation.goToView('changes') };
}
