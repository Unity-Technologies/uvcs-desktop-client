import { CommentLine } from '../../components/comments/CommentLine';
import { FileDiff, GitPullRequest, MessageSquareCode } from 'lucide-react';
import type { CodeReview } from '@shared/domain/codeReview';
import { spec } from '@shared/domain/specs';
import { DetailsHeading } from '../../components/DetailsHeading';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsChangesPane } from '../../ui/DetailsChangesPane';
import { DetailsCopyable } from '../../ui/DetailsCopyable';
import { DetailsPanel } from '../../ui/DetailsPanel';
import { DetailsEmpty, DetailsSection } from '../../ui/DetailsSection';
import { AttributesDetailsSection } from '../attributes/AttributesDetailsSection';
import { BranchChip } from '../branches/BranchChip';
import { ChangedFilesSection } from '../changesets/ChangedFilesSection';
import { openReview } from './codeReviewOperations';
import { changeableDestinationOf } from './changeableDestination';
import { DestinationPicker } from './DestinationPicker';
import { describeTarget, reviewDiffTarget } from './reviewTarget';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { reviewedChangesOf, reviewNoun } from './mergeRequestState';
import { MergeRequestStateBadge } from './MergeRequestStateBadge';
import { reviewStatusCellOf } from './reviewStatusCell';
import { ReviewCommentCounts } from './ReviewCommentCounts';
import { ReviewerList } from './ReviewerList';
import { reviewDetailsSections } from './reviewDetailsSections';
import { ReviewStanding } from './ReviewStanding';
import { copiedWhat } from '../../components/copyMenu';
import styles from './CodeReviewDetails.module.css';

export function CodeReviewDetails({ review, menu }: { review: CodeReview; menu: MenuEntry[] }) {
  const diffTarget = reviewDiffTarget(review.target);
  const { target, mergeRequest } = review;
  const noun = reviewNoun(review);
  const changes = reviewedChangesOf(review);
  const sections = reviewDetailsSections(review);
  const status = reviewStatusCellOf(review);
  // Where it merges changes from its chip while it can, as in its page's headline.
  const changeable = changeableDestinationOf(review);

  return (
    <DetailsPanel
      icon={mergeRequest ? <GitPullRequest /> : <MessageSquareCode />}
      kind={noun}
      heading={<DetailsHeading name={<CommentLine comment={review.title} />} />}
      author={{ user: review.owner, date: review.date }}
      meta={[
        <DetailsCopyable key="id" text={`#${review.id}`} copyText={String(review.id)} what={copiedWhat(noun, 'number')} />,
        changes.kind === 'branch' && <BranchChip key="target" name={changes.branch} />,
        changes.kind === 'merge' && (
          <span key="target" className={styles.merge}>
            <BranchChip name={changes.source} /> into{' '}
            {changeable ? <DestinationPicker review={review} source={changeable.source} destination={changeable.destination} look="chip" /> : <BranchChip name={changes.destination} />}
          </span>
        ),
        target.kind === 'changeset' && <DetailsCopyable key="target" text={spec.changeset(target.changesetId)} what={copiedWhat('Changeset', 'spec')} />,
        target.kind === 'shelve' && <DetailsCopyable key="target" text={spec.shelve(target.shelveId)} what={copiedWhat('Shelve', 'spec')} />,
      ]}
      badges={
        // A merge request's state, its verdict left to the Review section under it; a code review's status (`reviewStatusCellOf`).
        status.kind === 'mergeRequest' ? <MergeRequestStateBadge state={status.state} /> : <CodeReviewStatusBadge status={status.status} />
      }
      primaryAction={
        <Button variant="primary" size="small" icon={<FileDiff size={13} />} onClick={() => openReview(review)}>
          Open review
        </Button>
      }
      menu={menu}
      primaryActionId="openReview"
      properties={[
        { label: 'Comments', value: <ReviewCommentCounts review={review} /> },
        // The meta above already says where a merge request merges: its source into its destination.
        { label: 'Changes', value: describeTarget(target) },
        { label: 'Created', value: formatDateTime(review.date) },
        { label: 'Last activity', value: formatDateTime(review.lastActivity) },
      ]}
      changes={
        diffTarget ? (
          <ChangedFilesSection target={diffTarget} onOpen={(path) => openReview(review, path)} />
        ) : (
          <DetailsChangesPane title="Changes" expanded={false}>
            <DetailsEmpty>The reviewed changes are not available.</DetailsEmpty>
          </DetailsChangesPane>
        )
      }
    >
      {sections.review && (
        <DetailsSection title="Review">
          <ReviewStanding standing={sections.review} />
        </DetailsSection>
      )}
      <DetailsSection title="Reviewers">
        <ReviewerList reviewers={review.reviewers} />
      </DetailsSection>
      {sections.branchAttributes && <AttributesDetailsSection title="Branch attributes" objectSpec={sections.branchAttributes} />}
    </DetailsPanel>
  );
}
