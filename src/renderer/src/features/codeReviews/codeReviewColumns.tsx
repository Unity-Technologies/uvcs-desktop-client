import { CommentLine } from '../../components/comments/CommentLine';
import type { CodeReview } from '@shared/domain/codeReview';
import { PathLabel } from '../../components/PathLabel';
import { UserLabel } from '../../ui/Avatar';
import { Highlight } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import type { Column } from '../../ui/table/column';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { ReviewerStack } from './ReviewerStack';
import { describeTarget } from './reviewTarget';
import styles from './codeReviewColumns.module.css';

/**
 * Columns of the code reviews table: its number and title, status, who reviews it, what it reviews, who wrote it,
 * and when.
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
    grow: 1,
    hideBelow: 700,
    render: (review) => <ReviewerStack reviewers={review.reviewers} />,
    sortValue: (review) => review.reviewers.map((reviewer) => reviewer.name).join(','),
  },
  {
    id: 'target',
    header: 'Changes',
    grow: 1,
    secondary: true,
    hideBelow: 900,
    render: (review) => (review.target.kind === 'branch' ? <PathLabel path={review.target.branch} /> : <Highlight text={describeTarget(review.target)} />),
  },
  { id: 'owner', header: 'Author', grow: 1, hideBelow: 600, render: (review) => <UserLabel user={review.owner} />, sortValue: (review) => review.owner },
  { id: 'date', header: 'Created', width: 120, secondary: true, render: (review) => <RelativeTime date={review.date} />, sortValue: (review) => review.date },
];
