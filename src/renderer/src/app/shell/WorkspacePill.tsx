import { ChevronDown } from 'lucide-react';
import { RepositoryAvatar } from '../../components/RepositoryAvatar';
import { WorkspaceKindChip } from '../../components/WorkspaceKindChip';
import { workspacePillTip } from '../../components/workspaceKindWords';
import { SkeletonLine } from '../../ui/Skeleton';
import { ToolbarPill } from '../../ui/ToolbarPill';
import { useWorkspaceInfo, useWorkspacePath } from '../workspace/useWorkspace';
import { useWorkspacePreview } from './useWorkspacePreview';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { shownWorkspace } from './workspacePreview';
import styles from './PlacePill.module.css';

/** The widest the workspace's name and repository get: the branch after it needs the room more. */
const TEXT_MAX_WIDTH = 200;

/** While nothing is known of the workspace, its name and repository are bars about as wide as a typical one's. */
const NAME_PLACEHOLDER_WIDTH = 72;
const REPOSITORY_PLACEHOLDER_WIDTH = 120;

/**
 * The top bar's workspace, before its branch as a workspace holds a branch: its name, its kind unless standard, and
 * its repository, opening the switcher.
 */
export function WorkspacePill() {
  const { data: workspace } = useWorkspaceInfo();
  const workspacePath = useWorkspacePath();
  const { name, repository } = shownWorkspace(workspace, useWorkspacePreview(workspacePath));
  const tip = workspace && workspacePillTip(workspace);

  return (
    <WorkspaceSwitcher currentPath={workspacePath}>
      <ToolbarPill
        className={styles.pill}
        aria-label="Switch workspace"
        data-tip={tip?.text}
        data-tip-sub={tip?.sub}
        textMaxWidth={TEXT_MAX_WIDTH}
        icon={<RepositoryAvatar repository={repository} label={name} size={24} />}
        label={
          name === undefined ? (
            <SkeletonLine width={`${NAME_PLACEHOLDER_WIDTH}px`} />
          ) : (
            <span className={styles.nameLine}>
              <span className={styles.name}>{name}</span>
              <WorkspaceKindChip kind={workspace?.kind} />
            </span>
          )
        }
        sub={repository ?? <SkeletonLine width={`${REPOSITORY_PLACEHOLDER_WIDTH}px`} />}
        trailing={<ChevronDown size={14} className={styles.chevron} />}
      />
    </WorkspaceSwitcher>
  );
}
