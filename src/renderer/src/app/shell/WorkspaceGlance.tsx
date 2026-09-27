import { useQuery } from '@tanstack/react-query';
import { GitBranch } from 'lucide-react';
import { shortBranchName } from '@shared/domain/specs';
import { api } from '../../api/client';
import { workingObjectName } from '../../components/workingObject';
import styles from './WorkspaceGlance.module.css';

/** Read again when the switcher reopens after this long; forgotten as soon after it closes. */
const GLANCE_LIFETIME_MS = 15_000;

/**
 * What another workspace of the same repository is on and how many pending changes it has. One local `cm status`
 * per workspace, only while the switcher shows it, and reused for a few seconds.
 */
export function WorkspaceGlance({ workspacePath }: { workspacePath: string }) {
  const { data: glance } = useQuery({
    queryKey: ['workspaceGlance', workspacePath],
    queryFn: () => api.workspaces.glance(workspacePath),
    staleTime: GLANCE_LIFETIME_MS,
    gcTime: GLANCE_LIFETIME_MS,
    refetchOnWindowFocus: false,
  });
  if (!glance) return null;

  const fullName = workingObjectName(glance.selector);
  const shownName = glance.selector.kind === 'branch' ? shortBranchName(fullName) : fullName;
  return (
    <span className={styles.glance}>
      <span className={styles.branch} data-tip={fullName}>
        <GitBranch size={11} />
        {/* Not what the switcher's filter matches, so never marked. */}
        <span className={styles.branchName}>{shownName}</span>
      </span>
      {glance.pendingCount > 0 && (
        <span className={styles.pending} data-tip={glance.pendingCount === 1 ? '1 pending change' : `${glance.pendingCount} pending changes`}>
          {glance.pendingCount}
        </span>
      )}
    </span>
  );
}
