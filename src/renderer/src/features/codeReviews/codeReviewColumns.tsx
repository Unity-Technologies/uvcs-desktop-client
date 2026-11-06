import { CommentLine } from '../../components/comments/CommentLine';
import type { CodeReview } from '@shared/domain/codeReview';
import { PathLabel } from '../../components/PathLabel';
import { UserLabel } from '../../ui/Avatar';
import { Highlight } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import type { Column } from '../../ui/table/column';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { commentCountsSortValue } from './commentCounts';
import { ReviewCommentCounts } from './ReviewCommentCounts';
import { ReviewerStack } from './ReviewerStack';
import { describeTarget } from './reviewTarget';
import styles from './codeReviewColumns.module.css';

/**
 * Columns of the code reviews table: its number and title, status, who reviews it, its comments and how many are
 * still open, what it reviews, who wrote it, when (the list's order and its period go by it), and when anyone last did
 * something on it.
 */
export const CODE_REVIEW_COLUMNS: Column<CodeReview>[] = [
  {
    id: 'title',
    header: 'Title',
    grow: 3,
    render: (review) => (
      <span className={styles.title}>
        <span className={styles.id}>
          #<Highlight text={String(review.id)} />
        </span>
        <span className={styles.titleText}>
          <CommentLine comment={review.title} />
        </span>
      </span>
    ),
    sortValue: (review) => review.title.toLowerCase(),
  },
  { id: 'status', header: 'Status', width: 150, render: (review) => <CodeReviewStatusBadge status={review.status} />, sortValue: (review) => review.status },
  {
    id: 'reviewers',
    header: 'Reviewers',
    // Three avatars and "+N", or a sole reviewer's avatar and name.
    width: 130,
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
    grow: 1,
    secondary: true,
    hideBelow: 900,
    render: (review) => (review.target.kind === 'branch' ? <PathLabel path={review.target.branch} /> : <Highlight text={describeTarget(review.target)} />),
  },
  { id: 'owner', header: 'Author', grow: 1, hideBelow: 900, render: (review) => <UserLabel user={review.owner} />, sortValue: (review) => review.owner },
  { id: 'date', header: 'Created', width: 120, secondary: true, hideBelow: 1100, render: (review) => <RelativeTime date={review.date} />, sortValue: (review) => review.date },
  {
    id: 'lastActivity',
    header: 'Last activity',
    width: 120,
    secondary: true,
    render: (review) => <RelativeTime date={review.lastActivity} />,
    sortValue: (review) => review.lastActivity,
  },
];
