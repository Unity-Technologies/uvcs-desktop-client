import { api } from '../../api/client';
import { navigation } from '../navigation/navigationStore';
import { rememberRecentWorkspace } from '../settings/useSettings';
import { useSession } from './sessionStore';

/**
 * Opens a workspace on its Changes view and remembers it as recent. A workspace shown in another window isn't
 * opened twice: that window comes forward instead.
 */
export function useOpenWorkspace(): (path: string) => void {
  const openWorkspace = useSession((state) => state.openWorkspace);
  return (path) => void openUnlessShownElsewhere(path, openWorkspace);
}

async function openUnlessShownElsewhere(path: string, openWorkspace: (path: string) => void): Promise<void> {
  if (await api.windows.focusWorkspace(path)) return;
  navigation.goToView('changes');
  openWorkspace(path);
  void rememberRecentWorkspace(path);
}
