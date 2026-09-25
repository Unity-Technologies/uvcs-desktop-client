import { useEffect } from 'react';
import { workingObjectName } from '../../components/workingObject';
import { useWorkspaceInfo } from '../workspace/useWorkspace';

const APP_TITLE = 'Unity Version Control';

/** Titles the window "<workspace> — <branch>" (the OS shows it in the Window menu, Mission Control and the taskbar). */
export function useWindowTitle(): void {
  const { data: workspace } = useWorkspaceInfo();

  useEffect(() => {
    document.title = workspace ? `${workspace.name} — ${workingObjectName(workspace.selector)}` : APP_TITLE;
    return () => {
      document.title = APP_TITLE;
    };
  }, [workspace]);
}
