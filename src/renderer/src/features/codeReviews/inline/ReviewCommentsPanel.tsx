import { X } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '../../../ui/EmptyState';
import { IconButton } from '../../../ui/IconButton';
import { SegmentedControl } from '../../../ui/SegmentedControl';
import { SkeletonBar } from '../../../ui/Skeleton';
import { ThreadSummaryCard } from '../conversation/ReviewThreadCard';
import { commentsPanelCounts, commentsPanelThreads, emptyCommentsText, initialCommentsFilter, type CommentsFilter } from './commentsPanel';
import type { ReviewComments } from './reviewComments';
import styles from './ReviewCommentsPanel.module.css';

/**
 * Beside a review's Changes: every comment on its code, what's still open first, each as the conversation shows a
 * settled thread. A click goes to the thread, in the mode it was written in (`goToThread`).
 */
export function ReviewCommentsPanel({ comments, onClose }: { comments: ReviewComments; onClose: () => void }) {
  const { threads } = comments;
  return (
    <aside className={styles.panel} aria-label="Comments">
      {threads ? <PanelBody comments={comments} threads={threads} onClose={onClose} /> : <Loading />}
    </aside>
  );
}

function PanelBody({ comments, threads, onClose }: { comments: ReviewComments; threads: NonNullable<ReviewComments['threads']>; onClose: () => void }) {
  const [filter, setFilter] = useState<CommentsFilter>(() => initialCommentsFilter(threads));
  const counts = commentsPanelCounts(threads);
  const listed = commentsPanelThreads(threads, filter);
  const { seeInContext } = comments;
  const empty = emptyCommentsText(filter, counts);
  return (
    <>
      <header className={styles.header}>
        <h2 className={styles.title}>Comments</h2>
        <SegmentedControl<CommentsFilter>
          label="Comments to list"
          value={filter}
          onChange={setFilter}
          segments={[
            { value: 'open', label: `Open ${counts.open}`, title: 'Change requests to apply or discard, and questions to answer' },
            { value: 'all', label: `All ${counts.all}`, title: 'Every comment on the code' },
          ]}
        />
        {/* As the diff header's toggle does: the panel stays hidden until it's shown again. */}
        <IconButton size="small" icon={<X size={14} />} label="Hide Comments panel" onClick={onClose} />
      </header>
      {listed.length === 0 ? (
        <EmptyState title={empty.title} description={empty.description} />
      ) : (
        <ul className={styles.list}>
          {listed.map((thread) => (
            <li key={thread.root.id}>
              <ThreadSummaryCard
                reviewId={comments.review.id}
                thread={thread}
                current={comments.focus?.threadId === thread.root.id}
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
