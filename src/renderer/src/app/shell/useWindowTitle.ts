import { useEffect } from 'react';
import { workingObjectName } from '../../components/workingObject';
import { useWorkspaceInfo } from '../workspace/useWorkspace';
import { APP_TITLE, repositoryWindowTitle } from './windowTitle';

/** Titles the window "<workspace> — <branch>" (the OS shows it in the Window menu, Mission Control and the taskbar). */
export function useWindowTitle(): void {
  const { data: workspace } = useWorkspaceInfo();
  useDocumentTitle(workspace ? `${workspace.name} — ${workingObjectName(workspace.selector)}` : APP_TITLE);
}

/** Titles the window of a repository explored without a workspace after it (`repositoryWindowTitle`). */
export function useRepositoryWindowTitle(repository: string): void {
  useDocumentTitle(repositoryWindowTitle(repository));
}

function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
    return () => {
      document.title = APP_TITLE;
    };
  }, [title]);
}
