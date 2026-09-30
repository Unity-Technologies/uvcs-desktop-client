import { useEffect } from 'react';
import { api } from '../../api/client';
import { useUvcsEvent } from '../../api/useUvcsEvent';
import { useOpenWorkspace } from './useOpenWorkspace';

/**
 * Opens the workspace the main process asks this window to open: the one it was opened for (already open from the
 * page's address, `openWorkspaceFromAddress`: this remembers it as recent) and one picked from the OS recent documents
 * while the app runs.
 */
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
