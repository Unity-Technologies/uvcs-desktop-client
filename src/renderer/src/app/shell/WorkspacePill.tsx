import { ChevronDown } from 'lucide-react';
import { RepositoryAvatar } from '../../components/RepositoryAvatar';
import { WorkspaceKindChip } from '../../components/WorkspaceKindChip';
import { workspacePillTip } from '../../components/workspaceKindWords';
import { ToolbarPill } from '../../ui/ToolbarPill';
import { useWorkspaceInfo, useWorkspacePath } from '../workspace/useWorkspace';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import styles from './PlacePill.module.css';

/** The widest the workspace's name and repository get: the branch after it needs the room more. */
const TEXT_MAX_WIDTH = 200;

/**
 * The top bar's workspace, before its branch as a workspace holds a branch: its name, its kind unless standard, and
 * its repository, opening the switcher.
 */
export function WorkspacePill() {
  const { data: workspace } = useWorkspaceInfo();
  const workspacePath = useWorkspacePath();
  const tip = workspace && workspacePillTip(workspace);

  return (
    <WorkspaceSwitcher currentPath={workspacePath}>
      <ToolbarPill
        className={styles.pill}
        aria-label="Switch workspace"
        data-tip={tip?.text}
        data-tip-sub={tip?.sub}
        textMaxWidth={TEXT_MAX_WIDTH}
        icon={<RepositoryAvatar repository={workspace?.repository} label={workspace?.name} size={24} />}
        label={
          <span className={styles.nameLine}>
            <span className={styles.name}>{workspace?.name ?? '…'}</span>
            <WorkspaceKindChip kind={workspace?.kind} />
          </span>
        }
        sub={workspace?.repository}
        trailing={<ChevronDown size={14} className={styles.chevron} />}
      />
    </WorkspaceSwitcher>
  );
}
