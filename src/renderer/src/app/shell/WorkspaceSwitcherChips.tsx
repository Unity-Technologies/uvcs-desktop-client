import { SelectorChip } from '../../components/SelectorChip';
import { ServerChip } from '../../components/ServerChip';
import type { WorkspaceEntry } from '../home/recentWorkspaces';
import { useWorkspaceGlance } from './useWorkspaceGlance';
import styles from './WorkspaceSwitcher.module.css';

interface WorkspaceSwitcherChipsProps {
  entry: WorkspaceEntry;
  /** Of the open workspace's repository: its branch as `cm status` reads it, and its pending changes. */
  sameRepository: boolean;
}

/**
 * A switcher row's workspace told as the home screen tells it: its branch and its server. When the row is short of
 * room the server gives way first, down to its icon, then the branch's name.
 */
export function WorkspaceSwitcherChips({ entry, sameRepository }: WorkspaceSwitcherChipsProps) {
  const glance = useWorkspaceGlance(entry.workspace.path, sameRepository);
  const selector = glance?.selector ?? entry.selector;
  const pendingCount = glance?.pendingCount ?? 0;
  return (
    <span className={styles.chips}>
      {selector && <SelectorChip selector={selector} className={styles.branchChip} />}
      {pendingCount > 0 && (
        <span className={styles.pending} data-tip={pendingCount === 1 ? '1 pending change' : `${pendingCount} pending changes`}>
          {pendingCount}
        </span>
      )}
      {entry.repository && <ServerChip repository={entry.repository} className={styles.serverChip} />}
    </span>
  );
}
