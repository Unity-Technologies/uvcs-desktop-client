import { commentText } from '../../lib/comments/commentText';
import { CommentLine } from '../../components/comments/CommentLine';
import { GitBranch } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { Branch } from '@shared/domain/branch';
import { PathLabel } from '../../components/PathLabel';
import { WorkspaceMark } from '../../components/WorkspaceMark';
import { formatDateTime, formatRelativeDate } from '../../lib/formatDate';
import styles from './BranchSearchList.module.css';

interface BranchSearchItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  branch: Branch;
  current: boolean;
  /** After the name: its review's chip (`BranchSearchList`'s `mergeRequests`). */
  badge?: ReactNode;
}

/** A branch in the list: its name, and its review's chip where the list shows them, over the first line of its comment, and when it was created. */
export const BranchSearchItem = forwardRef<HTMLButtonElement, BranchSearchItemProps>(function BranchSearchItem(
  { branch, current, badge, ...rest },
  ref,
) {
  const comment = branch.comment.trim();
  const firstLine = comment.split('\n', 1)[0]!;
  const multiline = firstLine !== comment;

  return (
    <button ref={ref} type="button" className={styles.item} data-current={current} {...rest}>
      <GitBranch size={14} className={styles.icon} />
      <span className={styles.text}>
        <span className={styles.nameLine}>
          <span className={styles.name}>
            {/* Sized by the path, so the chip after it sits at its end, as in the Branches view. */}
            <PathLabel path={branch.name} fitContent />
          </span>
          {badge}
        </span>
        {firstLine && (
          // A clipped or multi-line comment shows in full on hover.
          <span className={styles.comment} data-tip={commentText(comment)} data-tip-overflow={multiline ? undefined : ''}>
            <CommentLine comment={comment} interactive={false} />
          </span>
        )}
      </span>
      {current && <WorkspaceMark on="branch" />}
      <span className={styles.date} data-tip={`Created ${formatDateTime(branch.date)}`}>
        {formatRelativeDate(branch.date)}
      </span>
    </button>
  );
});
