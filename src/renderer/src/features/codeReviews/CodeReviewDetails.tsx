import { FileDiff, MessageSquareCode } from 'lucide-react';
import { Fragment } from 'react';
import type { CodeReview } from '@shared/domain/codeReview';
import { spec } from '@shared/domain/specs';
import { DetailsHeading } from '../../components/DetailsHeading';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { DetailsChangesPane, DetailsCopyable, DetailsEmpty, DetailsPanel } from '../../ui/DetailsPanel';
import { BranchChip } from '../branches/BranchChip';
import { ChangedFilesSection } from '../changesets/ChangedFilesSection';
import { describeTarget, openReview, reviewDiffTarget } from './codeReviewOperations';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';

export function CodeReviewDetails({ review, menu }: { review: CodeReview; menu: MenuEntry[] }) {
  const diffTarget = reviewDiffTarget(review.target);
  const { target } = review;

  return (
    <DetailsPanel
      icon={<MessageSquareCode />}
      kind="Code review"
      heading={<DetailsHeading name={review.title} />}
      author={{ user: review.owner, date: review.date }}
      meta={[
        <DetailsCopyable key="id" text={`#${review.id}`} copyText={String(review.id)} what="Code review id" />,
        target.kind === 'branch' && <BranchChip key="target" name={target.branch} />,
        target.kind === 'changeset' && <DetailsCopyable key="target" text={spec.changeset(target.changesetId)} what="Changeset spec" />,
        review.assignee && (
          <Fragment key="reviewer">
            for <UserLabel user={review.assignee} />
          </Fragment>
        ),
      ]}
      badges={<CodeReviewStatusBadge status={review.status} />}
      primaryAction={
        <Button variant="primary" size="small" icon={<FileDiff size={13} />} onClick={() => openReview(review)}>
          Open review
        </Button>
      }
      menu={menu}
      primaryActionId="open"
      properties={[
        { label: 'Reviewer', value: review.assignee ? <UserLabel user={review.assignee} /> : 'Unassigned' },
        { label: 'Changes', value: describeTarget(target) },
        { label: 'Created', value: formatDateTime(review.date) },
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
