import { CommentLine } from '../../components/comments/CommentLine';
import { FileDiff, MessageSquareCode } from 'lucide-react';
import type { CodeReview } from '@shared/domain/codeReview';
import { spec } from '@shared/domain/specs';
import { DetailsHeading } from '../../components/DetailsHeading';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { Button } from '../../ui/Button';
import { DetailsChangesPane } from '../../ui/DetailsChangesPane';
import { DetailsCopyable } from '../../ui/DetailsCopyable';
import { DetailsPanel } from '../../ui/DetailsPanel';
import { DetailsEmpty } from '../../ui/DetailsSection';
import { BranchChip } from '../branches/BranchChip';
import { ChangedFilesSection } from '../changesets/ChangedFilesSection';
import { openReview } from './codeReviewOperations';
import { describeTarget, reviewDiffTarget } from './reviewTarget';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';
import { ReviewCommentCounts } from './ReviewCommentCounts';
import { ReviewerStack } from './ReviewerStack';
import { copiedWhat } from '../../components/copyMenu';

export function CodeReviewDetails({ review, menu }: { review: CodeReview; menu: MenuEntry[] }) {
  const diffTarget = reviewDiffTarget(review.target);
  const { target } = review;

  return (
    <DetailsPanel
      icon={<MessageSquareCode />}
      kind="Code review"
      heading={<DetailsHeading name={<CommentLine comment={review.title} />} />}
      author={{ user: review.owner, date: review.date }}
      meta={[
        <DetailsCopyable key="id" text={`#${review.id}`} copyText={String(review.id)} what={copiedWhat('Code review', 'number')} />,
        target.kind === 'branch' && <BranchChip key="target" name={target.branch} />,
        target.kind === 'changeset' && <DetailsCopyable key="target" text={spec.changeset(target.changesetId)} what={copiedWhat('Changeset', 'spec')} />,
        target.kind === 'shelve' && <DetailsCopyable key="target" text={spec.shelve(target.shelveId)} what={copiedWhat('Shelve', 'spec')} />,
      ]}
      badges={<CodeReviewStatusBadge status={review.status} />}
      primaryAction={
        <Button variant="primary" size="small" icon={<FileDiff size={13} />} onClick={() => openReview(review)}>
          Open review
        </Button>
      }
      menu={menu}
      primaryActionId="openReview"
      properties={[
        { label: 'Reviewers', value: <ReviewerStack reviewers={review.reviewers} /> },
        { label: 'Comments', value: <ReviewCommentCounts review={review} /> },
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
    />
  );
}
