import { House } from 'lucide-react';
import styles from './WorkspaceMark.module.css';

interface WorkspaceMarkProps {
  /** What the workspace is on, for its tooltip. */
  on: 'changeset' | 'branch' | 'revision';
}

/** "You are here": the house the Branch Explorer draws at the workspace, beside the changeset or branch it's on. */
export function WorkspaceMark({ on }: WorkspaceMarkProps) {
  const tip = `Your workspace is on this ${on}`;
  return (
    <span className={styles.mark} role="img" aria-label={tip} data-tip={tip}>
      <House size={12} strokeWidth={2.25} />
    </span>
  );
}
