import { navigation } from '../navigation/navigationStore';
import { rememberRecentWorkspace } from '../settings/useSettings';
import { useSession } from './sessionStore';

/** Opens a workspace on its Changes view and remembers it as recent. */
export function useOpenWorkspace(): (path: string) => void {
  const openWorkspace = useSession((state) => state.openWorkspace);
  return (path) => {
    navigation.goToView('changes');
    openWorkspace(path);
    void rememberRecentWorkspace(path);
  };
}
