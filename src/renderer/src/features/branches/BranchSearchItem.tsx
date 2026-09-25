import { GitBranch } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { Branch } from '@shared/domain/branch';
import { formatDateTime, formatRelativeDate } from '../../lib/formatDate';
import { Highlight } from '../../ui/Highlight';
import styles from './BranchSearchList.module.css';

interface BranchSearchItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  branch: Branch;
  current: boolean;
  highlighted: boolean;
}

/** A branch in the list: its name over the first line of its comment, and when it was created. */
export const BranchSearchItem = forwardRef<HTMLButtonElement, BranchSearchItemProps>(function BranchSearchItem(
  { branch, current, highlighted, ...rest },
  ref,
) {
  const comment = branch.comment.trim();
  const firstLine = comment.split('\n', 1)[0]!;
  const multiline = firstLine !== comment;

  return (
    <button ref={ref} type="button" className={styles.item} data-highlighted={highlighted} data-current={current} {...rest}>
      <GitBranch size={14} className={styles.icon} />
      <span className={styles.text}>
        <span className={styles.name}>
          <Highlight text={branch.name} />
        </span>
        {firstLine && (
          // A clipped or multi-line comment shows in full on hover.
          <span className={styles.comment} data-tip={comment} data-tip-overflow={multiline ? undefined : ''}>
            <Highlight text={firstLine} />
          </span>
        )}
      </span>
      {current && <span className={styles.current}>Current</span>}
      <span className={styles.date} data-tip={`Created ${formatDateTime(branch.date)}`}>
        {formatRelativeDate(branch.date)}
      </span>
    </button>
  );
});
