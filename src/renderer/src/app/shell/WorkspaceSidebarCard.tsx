import { ChevronsUpDown } from 'lucide-react';
import { RepositoryAvatar } from '../../components/RepositoryAvatar';
import { useWorkspaceInfo, useWorkspacePath } from '../workspace/useWorkspace';
import { useSidebarCollapsed } from './sidebarStore';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import styles from './Sidebar.module.css';

/** The sidebar's card of a workspace: its name and repository, opening the switcher. */
export function WorkspaceSidebarCard() {
  const { data: workspace } = useWorkspaceInfo();
  const workspacePath = useWorkspacePath();
  const rail = useSidebarCollapsed();

  return (
    <WorkspaceSwitcher currentPath={workspacePath}>
      <button
        className={styles.workspace}
        data-rail={rail}
        aria-label="Switch workspace"
        data-tip={rail ? workspace && `${workspace.name} · ${workspace.repository}` : undefined}
      >
        <RepositoryAvatar repository={workspace?.repository} label={workspace?.name} size={28} />
        <span className={styles.workspaceText}>
          <span className={styles.workspaceName}>{workspace?.name ?? '…'}</span>
          <span className={styles.workspaceRepo}>{workspace?.repository}</span>
        </span>
        <ChevronsUpDown size={14} className={styles.workspaceChevron} />
      </button>
    </WorkspaceSwitcher>
  );
}
