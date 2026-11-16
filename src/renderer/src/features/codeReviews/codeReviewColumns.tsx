import { MessageSquareCode } from 'lucide-react';
import { CommentLine } from '../../components/comments/CommentLine';
import type { CodeReview } from '@shared/domain/codeReview';
import { PathLabel } from '../../components/PathLabel';
import { UserLabel } from '../../ui/Avatar';
import { Highlight } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import type { Column } from '../../ui/table/column';
import { commentCountsSortValue } from './commentCounts';
import { ReviewCommentCounts } from './ReviewCommentCounts';
import { REVIEWERS_COLUMN_WIDTH } from './reviewers';
import { ReviewerStack } from './ReviewerStack';
import { reviewedChangesOf } from './mergeRequestState';
import { MergeRequestStateIcon } from './MergeRequestStateIcon';
import { MergeVerdictIcon } from './MergeVerdictIcon';
import { reviewStatusCellOf } from './reviewStatusCell';
import { ReviewStatusIcon } from './ReviewStatusIcon';
import { waitingForMe, waitingForMeTip } from './waitingForMe';
import styles from './codeReviewColumns.module.css';

/**
 * Columns of the Merge requests table, which lists code reviews too: its glyph (a merge request's state, a code
 * review's own), its title and, after it, where it stands as an icon (a merge request its verdict, as by a branch; a
 * code review its status: `reviewStatusCellOf`), saving a Status column; who reviews it, its comments and how many are still open, what it
 * reviews (and where a merge request merges it), who wrote it, and when anyone last did something on it. When it was
 * created has no column, to keep the rows light: the list comes newest first as read, its period goes by it, and the
 * details panel says it. A review waiting for `user` has a dot before its glyph (`waitingForMe`).
 */
export function codeReviewColumns(user: string | undefined): Column<CodeReview>[] {
  return [
    {
      id: 'title',
      header: 'Title',
      grow: 3,
      render: (review) => (
        <>
          <WaitingDot review={review} user={user} />
          {/* What it is and, for a merge request, its state, by its glyph before the title, as pull requests read; never
              its number, which the details panel and the text filter keep (merge-requests.md "Its number"). */}
          <span className={styles.stateSlot}>
            {review.mergeRequest ? (
              <MergeRequestStateIcon mergeRequest={review.mergeRequest} />
            ) : (
              <span className={styles.kindIcon} role="img" aria-label="Code review" data-tip="Code review">
                <MessageSquareCode size={14} aria-hidden />
              </span>
            )}
          </span>
          <span className={styles.title}>
            <span className={styles.titleText}>
              <CommentLine comment={review.title} />
            </span>
            <ReviewStatusMark review={review} />
          </span>
        </>
      ),
      sortValue: (review) => review.title.toLowerCase(),
    },
    {
      id: 'reviewers',
      header: 'Reviewers',
      width: REVIEWERS_COLUMN_WIDTH,
      hideBelow: 700,
      render: (review) => <ReviewerStack reviewers={review.reviewers} />,
      sortValue: (review) => review.reviewers.map((reviewer) => reviewer.name).join(','),
    },
    {
      id: 'comments',
      header: 'Comments',
      width: 110,
      hideBelow: 760,
      render: (review) => <ReviewCommentCounts review={review} />,
      sortValue: commentCountsSortValue,
    },
    {
      id: 'target',
      header: 'Changes',
      // A merge request shows two branches here.
      grow: 2,
      secondary: true,
      hideBelow: 900,
      render: (review) => <ReviewedChanges review={review} />,
    },
    { id: 'owner', header: 'Author', grow: 1, hideBelow: 900, render: (review) => <UserLabel user={review.owner} />, sortValue: (review) => review.owner },
    {
      id: 'lastActivity',
      header: 'Last activity',
      width: 120,
      secondary: true,
      render: (review) => <RelativeTime date={review.lastActivity} />,
      sortValue: (review) => review.lastActivity,
    },
  ];
}

function WaitingDot({ review, user }: { review: CodeReview; user: string | undefined }) {
  const waiting = waitingForMe(review, user);
  if (!waiting) return null;
  const tip = waitingForMeTip(waiting);
  return <span className={styles.waiting} role="img" aria-label={tip} data-tip={tip} />;
}

/** What a review reviews; for a merge request, its branch into its destination, the destination kept when narrow. */
function ReviewedChanges({ review }: { review: CodeReview }) {
  const changes = reviewedChangesOf(review);
  if (changes.kind === 'text') return <Highlight text={changes.text} />;
  if (changes.kind === 'branch') return <PathLabel path={changes.branch} />;
  return (
    <span className={styles.merge} data-tip={`Merge ${changes.source} into ${changes.destination}`}>
      <span className={styles.source}>
        <PathLabel path={changes.source} tooltip={false} fitContent />
      </span>
      <span className={styles.arrow} role="img" aria-label="into">
        →
      </span>
      <span className={styles.destination}>
        <PathLabel path={changes.destination} tooltip={false} fitContent />
      </span>
    </span>
  );
}

/**
 * Where it stands, an icon after the title: a merge request's verdict, as by a branch (its state leads the row); a code
 * review's status. Named by its tooltip.
 */
function ReviewStatusMark({ review }: { review: CodeReview }) {
  const cell = reviewStatusCellOf(review);
  if (cell.kind === 'codeReview') {
    return (
      <span className={styles.mark}>
        <ReviewStatusIcon status={cell.status} size={13} label={cell.status} />
      </span>
    );
  }
  return cell.verdict ? (
    <span className={styles.mark}>
      <MergeVerdictIcon verdict={cell.verdict} />
    </span>
  ) : null;
}
