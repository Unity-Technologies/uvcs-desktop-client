import { MoreHorizontal } from 'lucide-react';
import type { WorkspaceSelector, WorkspaceSummary } from '@shared/domain/workspace';
import { MissingChip } from '../../components/MissingChip';
import { RepositoryAvatar } from '../../components/RepositoryAvatar';
import { SelectorChip } from '../../components/SelectorChip';
import { ServerChip } from '../../components/ServerChip';
import { splitRepositorySpec } from '../../lib/servers';
import { Button } from '../../ui/Button';
import { Highlight } from '../../ui/Highlight';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { missingWorkspaceMenu, workspaceMenu } from './homeMenus';
import styles from './Home.module.css';

interface WorkspaceRowProps {
  workspace: WorkspaceSummary;
  /** `name@server`; undefined while still resolving, null when unknown. */
  repository?: string | null;
  /** What it's loaded from, when known without asking the server. */
  selector?: WorkspaceSelector | null;
  /** Its folder is gone: dimmed, and opening it offers to locate or recreate it. */
  missing?: boolean;
  onOpen: (path: string) => void;
  compact?: boolean;
}

export function WorkspaceRow({ workspace, repository, selector, missing = false, onOpen, compact }: WorkspaceRowProps) {
  const menu = () => (missing ? missingWorkspaceMenu(workspace, onOpen) : workspaceMenu(workspace, onOpen));
  const repositoryName = repository && splitRepositorySpec(repository).name;
  const showsRepository = repositoryName && repositoryName.toLowerCase() !== workspace.name.toLowerCase();

  return (
    <ActionContextMenu entries={menu}>
      <div className={styles.row} data-compact={compact} data-missing={missing}>
        <button className={styles.rowMain} data-workspace-row onClick={() => onOpen(workspace.path)}>
          <RepositoryAvatar repository={repository} label={workspace.name} size={compact ? 24 : 32} className={styles.rowAvatar} />
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>
              <span className={styles.rowName}>
                <Highlight text={workspace.name} />
              </span>
              {!compact && showsRepository && (
                <span className={styles.rowRepository}>
                  <Highlight text={repositoryName} />
                </span>
              )}
            </span>
            <span className={styles.rowSubtitle}>
              <Highlight text={workspace.path} />
            </span>
          </span>
          {missing && <MissingChip />}
          {!compact && !missing && selector && <SelectorChip selector={selector} className={styles.rowChip} />}
          {!compact && !missing && repository && <ServerChip repository={repository} className={styles.rowChip} />}
        </button>
        <ActionDropdownMenu entries={menu()}>
          <Button variant="ghost" size="small" className={styles.rowMenu} icon={<MoreHorizontal size={15} />} aria-label="Workspace actions" />
        </ActionDropdownMenu>
      </div>
    </ActionContextMenu>
  );
}
