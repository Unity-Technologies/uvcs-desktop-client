import { ChevronsUpDown } from 'lucide-react';
import { RepositoryAvatar } from '../../components/RepositoryAvatar';
import { describeServer, splitRepositorySpec } from '../../lib/servers';
import { useSidebarCollapsed } from './sidebarStore';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import styles from './Sidebar.module.css';

/**
 * The sidebar's card of a repository explored without a workspace: its name and its server, as the home screen names
 * them, opening the switcher to go to a workspace.
 */
export function RepositorySidebarCard({ repository }: { repository: string }) {
  const rail = useSidebarCollapsed();
  const { name, server } = splitRepositorySpec(repository);
  const where = describeServer(server).label;

  return (
    <WorkspaceSwitcher currentPath={null}>
      <button className={styles.workspace} data-rail={rail} aria-label="Switch workspace" data-tip={rail ? `${name} · ${where}` : undefined}>
        <RepositoryAvatar repository={repository} label={name} size={28} />
        <span className={styles.workspaceText}>
          <span className={styles.workspaceName}>{name}</span>
          <span className={styles.workspaceRepo}>{where}</span>
        </span>
        <ChevronsUpDown size={14} className={styles.workspaceChevron} />
      </button>
    </WorkspaceSwitcher>
  );
}
