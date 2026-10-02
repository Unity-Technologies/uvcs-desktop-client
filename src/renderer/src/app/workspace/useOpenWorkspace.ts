import { useCallback } from 'react';
import { api } from '../../api/client';
import { navigation } from '../navigation/navigationStore';
import { rememberRecentWorkspace } from '../settings/useSettings';
import { useSession } from './sessionStore';

/**
 * Opens a workspace on its Changes view and remembers it as recent. A workspace shown in another window isn't
 * opened twice: that window comes forward instead. The one this window already shows keeps its view: the main
 * process's request for the workspace a window opened on (`useRequestedWorkspace`) comes after the page's address
 * opened it, on the view it showed before restarting to install an update.
 */
export function useOpenWorkspace(): (path: string) => void {
  const openWorkspace = useSession((state) => state.openWorkspace);
  return useCallback((path: string) => void openUnlessShownElsewhere(path, openWorkspace), [openWorkspace]);
}

export async function openUnlessShownElsewhere(path: string, openWorkspace: (path: string) => void): Promise<void> {
  if (await api.windows.focusWorkspace(path)) return;
  if (useSession.getState().workspacePath !== path) navigation.goToView('changes');
  openWorkspace(path);
  void rememberRecentWorkspace(path);
}
