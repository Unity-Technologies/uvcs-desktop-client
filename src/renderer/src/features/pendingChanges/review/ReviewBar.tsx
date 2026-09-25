import { CircleCheck, Eraser, ListChecks, MoreHorizontal, X } from 'lucide-react';
import type { CSSProperties } from 'react';
import { IconButton } from '../../../ui/IconButton';
import { ActionDropdownMenu } from '../../../ui/menu/ActionDropdownMenu';
import { ToggleChip } from '../../../ui/ToggleChip';
import type { ReviewProgress } from './reviewProgress';
import styles from './ReviewStrip.module.css';

interface ReviewBarProps {
  progress: ReviewProgress;
  onlyUnreviewed: boolean;
  onOnlyUnreviewedChange: (only: boolean) => void;
  onMarkAll: () => void;
  onClearMarks: () => void;
  hasMarks: boolean;
  /** Leaves review mode; the marks stay for when it's back. */
  onLeave: () => void;
}

/** How far the review of the pending changes got, a filter for what is left, and ways to mark or clear everything. */
export function ReviewBar({ progress, onlyUnreviewed, onOnlyUnreviewedChange, onMarkAll, onClearMarks, hasMarks, onLeave }: ReviewBarProps) {
  const { total, reviewed } = progress;
  const left = total - reviewed;
  const done = left === 0;

  return (
    <div className={styles.strip} data-done={done}>
      {done ? <CircleCheck size={13} className={styles.icon} /> : <ListChecks size={13} className={styles.icon} />}
      <span className={styles.label} data-tip="Mark files as you review them: R toggles, J and K move">
        {reviewed} of {total} reviewed
      </span>
      <span className={styles.meter} style={{ '--progress': `${(reviewed / total) * 100}%` } as CSSProperties} />
      {(left > 0 || onlyUnreviewed) && (
        <ToggleChip pressed={onlyUnreviewed} onChange={onOnlyUnreviewedChange}>
          Unreviewed ({left})
        </ToggleChip>
      )}
      <ActionDropdownMenu
        entries={[
          { id: 'review.markAll', label: 'Mark all reviewed', icon: CircleCheck, disabled: done, run: onMarkAll },
          { id: 'review.clear', label: 'Clear review marks', icon: Eraser, disabled: !hasMarks, run: onClearMarks },
        ]}
      >
        <IconButton size="small" className={styles.push} icon={<MoreHorizontal size={14} />} label="Review actions" />
      </ActionDropdownMenu>
      <IconButton size="small" icon={<X size={13} />} label="Leave review mode" onClick={onLeave} />
    </div>
  );
}
