import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { hotkey } from '../../../lib/shortcutRegistry';
import { EmptyState } from '../../../ui/EmptyState';
import { IconButton } from '../../../ui/IconButton';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { SkeletonBar } from '../../../ui/Skeleton';
import { ThreadSummaryCard } from '../conversation/ReviewThreadCard';
import { commentPosition, commentsPanelCounts, emptyCommentsText, steppedThread, type CommentsFilter } from './commentsPanel';
import type { LineThread } from './fileThreads';
import type { ReviewComments } from './reviewComments';
import styles from './ReviewCommentsPanel.module.css';

interface ReviewCommentsPanelProps {
  comments: ReviewComments;
  /** What it lists, kept by the Changes tab so the keys go through the same comments while it's hidden. */
  filter: CommentsFilter;
  onFilterChange: (filter: CommentsFilter) => void;
  listed: readonly LineThread[];
  /** Every comment, in the order the panel lists them: where one that left the list sat. */
  all: readonly LineThread[];
  /** Goes to the comment after or before the one gone to (`steppedThread`). */
  onStep: (direction: 1 | -1) => void;
  onClose: () => void;
}

/**
 * Beside a review's Changes: every comment on its code, what's still open first, each as the conversation shows a
 * settled thread. A click goes to the thread, in the mode it was written in (`goToThread`); the arrows (N, ⇧N) go
 * through them one by one.
 */
export function ReviewCommentsPanel({ comments, ...props }: ReviewCommentsPanelProps) {
  const { threads } = comments;
  return (
    <aside className={styles.panel} aria-label="Comments">
      {threads ? <PanelBody comments={comments} threads={threads} {...props} /> : <Loading />}
    </aside>
  );
}

function PanelBody({ comments, threads, filter, onFilterChange, listed, all, onStep, onClose }: ReviewCommentsPanelProps & { threads: NonNullable<ReviewComments['threads']> }) {
  const counts = commentsPanelCounts(threads);
  const empty = emptyCommentsText(filter, counts);
  const current = comments.focus?.threadId;
  const { seeInContext } = comments;
  return (
    <>
      <header className={styles.header}>
        <h2 className={styles.title}>Comments</h2>
        <SegmentedControl<CommentsFilter>
          label="Comments to list"
          value={filter}
          onChange={onFilterChange}
          segments={[
            { value: 'open', label: `Open ${counts.open}`, title: 'Change requests to apply or discard, and questions to answer' },
            { value: 'all', label: `All ${counts.all}`, title: 'Every comment on the code' },
          ]}
        />
        {/* As the diff header's toggle does: the panel stays hidden until it's shown again. */}
        <IconButton size="small" icon={<X size={14} />} label="Hide Comments panel" onClick={onClose} />
      </header>
      {listed.length > 0 && (
        <div className={styles.stepper}>
          <span className={styles.position}>{commentPosition(listed, current)}</span>
          <IconButton size="small" icon={<ChevronUp size={14} />} label="Previous comment" shortcut={hotkey('previousComment')} disabled={steppedThread(listed, all, current, -1) === null} onClick={() => onStep(-1)} />
          <IconButton size="small" icon={<ChevronDown size={14} />} label="Next comment" shortcut={hotkey('nextComment')} disabled={steppedThread(listed, all, current, 1) === null} onClick={() => onStep(1)} />
        </div>
      )}
      {listed.length === 0 ? (
        <EmptyState title={empty.title} description={empty.description} />
      ) : (
        <ul className={styles.list}>
          {listed.map((thread) => (
            <li key={thread.root.id}>
              <ThreadSummaryCard
                reviewId={comments.review.id}
                thread={thread}
                current={current === thread.root.id}
                onOpen={() => comments.goToThread(thread)}
                onSeeApplied={seeInContext && (() => seeInContext(thread, { startsOn: 'since' }))}
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Loading() {
  return (
    <div className={styles.loading} aria-busy="true" aria-label="Loading">
      <SkeletonBar width="50%" />
      <SkeletonBar width="80%" />
      <SkeletonBar width="65%" />
    </div>
  );
}
