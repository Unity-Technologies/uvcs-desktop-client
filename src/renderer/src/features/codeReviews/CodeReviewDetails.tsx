import { FileDiff, MessageSquareCode } from 'lucide-react';
import type { CodeReview } from '@shared/domain/codeReview';
import type { MenuEntry } from '../../lib/actions';
import { formatDateTime } from '../../lib/formatDate';
import { UserLabel } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { DetailsEmpty, DetailsPanel, DetailsSection } from '../../ui/DetailsPanel';
import { PropertyList } from '../../ui/PropertyList';
import { ChangedFilesSection } from '../changesets/ChangedFilesSection';
import { describeTarget, openReview, reviewDiffTarget } from './codeReviewOperations';
import { CodeReviewStatusBadge } from './CodeReviewStatusBadge';

export function CodeReviewDetails({ review, menu }: { review: CodeReview; menu: MenuEntry[] }) {
  const diffTarget = reviewDiffTarget(review.target);

  return (
    <DetailsPanel
      icon={<MessageSquareCode />}
      kind={`Code review ${review.id}`}
      context={describeTarget(review.target)}
      title={review.title}
      author={{ user: review.owner, date: review.date }}
      badges={<CodeReviewStatusBadge status={review.status} />}
      primaryAction={
        <Button variant="primary" icon={<FileDiff size={14} />} onClick={() => openReview(review)}>
          Open review
        </Button>
      }
      menu={menu}
      primaryActionId="open"
    >
      {diffTarget ? (
        <ChangedFilesSection target={diffTarget} onOpen={(path) => openReview(review, path)} />
      ) : (
        <DetailsSection title="Files changed">
          <DetailsEmpty>The reviewed changes are not available.</DetailsEmpty>
        </DetailsSection>
      )}
      <DetailsSection title="Details">
        <PropertyList
          properties={[
            { label: 'Reviewer', value: review.assignee ? <UserLabel user={review.assignee} /> : 'Unassigned' },
            { label: 'Changes', value: describeTarget(review.target) },
            { label: 'Created', value: formatDateTime(review.date) },
          ]}
        />
      </DetailsSection>
    </DetailsPanel>
  );
}
