import { MoreHorizontal } from 'lucide-react';
import type { WorkspaceSummary } from '@shared/domain/workspace';
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
  /** Its folder is gone: dimmed, and opening it offers to locate or recreate it. */
  missing?: boolean;
  onOpen: (path: string) => void;
  compact?: boolean;
}

export function WorkspaceRow({ workspace, repository, missing = false, onOpen, compact }: WorkspaceRowProps) {
  const menu = () => (missing ? missingWorkspaceMenu(workspace, onOpen) : workspaceMenu(workspace, onOpen));

  return (
    <ActionContextMenu entries={menu}>
      <div className={styles.row} data-compact={compact} data-missing={missing}>
        <button className={styles.rowMain} onClick={() => onOpen(workspace.path)}>
          <span className={styles.rowIcon}>{workspace.name.charAt(0).toUpperCase()}</span>
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>
              <Highlight text={workspace.name} />
            </span>
            <span className={styles.rowSubtitle}>
              <Highlight text={workspace.path} />
            </span>
          </span>
          {missing && (
            <span className={styles.missingChip} data-tip="Its folder can't be found">
              Missing
            </span>
          )}
          {!compact && !missing && repository && (
            <span className={styles.chip}>
              <Highlight text={repository} />
            </span>
          )}
        </button>
        <ActionDropdownMenu entries={menu()}>
          <Button variant="ghost" size="small" className={styles.rowMenu} icon={<MoreHorizontal size={15} />} aria-label="Workspace actions" />
        </ActionDropdownMenu>
      </div>
    </ActionContextMenu>
  );
}
