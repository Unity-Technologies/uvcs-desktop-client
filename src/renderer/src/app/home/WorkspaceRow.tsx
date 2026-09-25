import { GitBranch, MoreHorizontal } from 'lucide-react';
import { shortBranchName } from '@shared/domain/specs';
import type { WorkspaceSelector, WorkspaceSummary } from '@shared/domain/workspace';
import { ServerIcon } from '../../components/ServerIcon';
import { SELECTOR_KIND_LABELS, workingObjectName } from '../../components/workingObject';
import { describeServer, splitRepositorySpec } from '../../lib/servers';
import { Button } from '../../ui/Button';
import { Highlight } from '../../ui/Highlight';
import { ActionContextMenu } from '../../ui/menu/ActionContextMenu';
import { ActionDropdownMenu } from '../../ui/menu/ActionDropdownMenu';
import { missingWorkspaceMenu, workspaceMenu } from './homeMenus';
import { RepositoryAvatar } from './RepositoryAvatar';
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
  const spec = repository ? splitRepositorySpec(repository) : null;
  const server = spec && describeServer(spec.server);
  const showsRepository = spec && spec.name.toLowerCase() !== workspace.name.toLowerCase();

  return (
    <ActionContextMenu entries={menu}>
      <div className={styles.row} data-compact={compact} data-missing={missing}>
        <button className={styles.rowMain} data-workspace-row onClick={() => onOpen(workspace.path)}>
          <RepositoryAvatar name={spec?.name ?? workspace.name} size={compact ? 24 : 32} />
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>
              <span className={styles.rowName}>
                <Highlight text={workspace.name} />
              </span>
              {!compact && showsRepository && (
                <span className={styles.rowRepository}>
                  <Highlight text={spec.name} />
                </span>
              )}
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
          {!compact && !missing && selector && <SelectorChip selector={selector} />}
          {!compact && !missing && spec && server && (
            <span className={styles.chip} data-tip={spec.server}>
              <ServerIcon server={spec.server} size={11} />
              <span className={styles.chipText}>{server.label}</span>
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

function SelectorChip({ selector }: { selector: WorkspaceSelector }) {
  const fullName = workingObjectName(selector);
  return (
    <span className={styles.chip} data-tip={SELECTOR_KIND_LABELS[selector.kind]} data-tip-sub={fullName}>
      <GitBranch size={11} />
      <span className={styles.chipText}>
        <Highlight text={selector.kind === 'branch' ? shortBranchName(fullName) : fullName} />
      </span>
    </span>
  );
}
