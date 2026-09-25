import { useEffect } from 'react';
import { api } from '../../api/client';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { useOpenWorkspace } from './useOpenWorkspace';

/** Opens the workspace picked from the OS recent documents, at launch or while the app runs. */
export function useRequestedWorkspace(): void {
  const openWorkspace = useOpenWorkspace();
  const openRequested = async (): Promise<void> => {
    const path = await api.system.takeRequestedWorkspace();
    if (path) openWorkspace(path);
  };

  useEffect(() => {
    void openRequested();
    // Only the request waiting at launch; later ones arrive as events.
  }, []);
  useUvcsEvent('workspaceOpenRequested', () => void openRequested());
}
