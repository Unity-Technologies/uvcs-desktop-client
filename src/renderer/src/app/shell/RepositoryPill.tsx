import { ChevronDown } from 'lucide-react';
import { RepositoryAvatar } from '../../components/RepositoryAvatar';
import { describeServer, splitRepositorySpec } from '../../lib/servers';
import { ToolbarPill } from '../../ui/ToolbarPill';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import styles from './PlacePill.module.css';

/** The widest the repository's name and server get, as a workspace's (`WorkspacePill`). */
const TEXT_MAX_WIDTH = 200;

/**
 * The top bar's repository explored without a workspace: its name and its server, as the home screen names them,
 * opening the switcher to go to a workspace.
 */
export function RepositoryPill({ repository }: { repository: string }) {
  const { name, server } = splitRepositorySpec(repository);
  const where = describeServer(server).label;

  return (
    <WorkspaceSwitcher currentPath={null}>
      <ToolbarPill
        className={styles.pill}
        aria-label="Switch workspace"
        data-tip={`${name} · ${where}`}
        textMaxWidth={TEXT_MAX_WIDTH}
        icon={<RepositoryAvatar repository={repository} label={name} size={24} />}
        label={name}
        sub={where}
        trailing={<ChevronDown size={14} className={styles.chevron} />}
      />
    </WorkspaceSwitcher>
  );
}
