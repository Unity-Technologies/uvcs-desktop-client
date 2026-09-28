import { GitBranch } from 'lucide-react';
import { shortBranchName } from '@shared/domain/specs';
import type { WorkspaceSelector } from '@shared/domain/workspace';
import { Highlight } from '../ui/Highlight';
import { SELECTOR_KIND_LABELS, workingObjectName } from './workingObject';
import styles from './WorkspaceChip.module.css';

/** What a workspace is on: a branch by its last segment, a changeset, label or shelve by its name; the full name in its tooltip. */
export function SelectorChip({ selector, className }: { selector: WorkspaceSelector; className?: string }) {
  const fullName = workingObjectName(selector);
  return (
    <span className={`${styles.chip} ${className ?? ''}`} data-tip={SELECTOR_KIND_LABELS[selector.kind]} data-tip-sub={fullName}>
      <GitBranch size={11} />
      <span className={styles.text}>
        <Highlight text={selector.kind === 'branch' ? shortBranchName(fullName) : fullName} />
      </span>
    </span>
  );
}
