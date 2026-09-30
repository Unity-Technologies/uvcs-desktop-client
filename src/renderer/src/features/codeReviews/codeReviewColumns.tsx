import type { CodeReview } from '@shared/domain/codeReview';
import { PathLabel } from '../../components/PathLabel';
import { UserLabel } from '../../ui/Avatar';
import { Highlight } from '../../ui/Highlight';
import { RelativeTime } from '../../ui/RelativeTime';
import type { Column } from '../../ui/table/DataTable';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { describeTarget } from './reviewTarget';
import styles from './codeReviewColumns.module.css';

/** Columns of the code reviews table: its number and title, status, what it reviews, who wrote it and who reviews it. */
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
          <Highlight text={review.title} />
        </span>
      </span>
    ),
    sortValue: (review) => review.title.toLowerCase(),
  },
  { id: 'status', header: 'Status', width: 150, render: (review) => <CodeReviewStatusBadge status={review.status} />, sortValue: (review) => review.status },
  {
    id: 'target',
    header: 'Changes',
    grow: 1,
    secondary: true,
    hideBelow: 820,
    render: (review) => (review.target.kind === 'branch' ? <PathLabel path={review.target.branch} /> : <Highlight text={describeTarget(review.target)} />),
  },
  { id: 'owner', header: 'Author', grow: 1, hideBelow: 600, render: (review) => <UserLabel user={review.owner} />, sortValue: (review) => review.owner },
  {
    id: 'assignee',
    header: 'Reviewer',
    grow: 1,
    hideBelow: 700,
    render: (review) => (review.assignee ? <UserLabel user={review.assignee} /> : <span className={styles.unassigned}>Unassigned</span>),
    sortValue: (review) => review.assignee,
  },
  { id: 'date', header: 'Created', width: 120, secondary: true, render: (review) => <RelativeTime date={review.date} />, sortValue: (review) => review.date },
];
