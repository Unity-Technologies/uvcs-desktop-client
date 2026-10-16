import { CODE_REVIEW_STATUSES, type CodeReviewStatus, type CodeReviewSummary } from '@shared/domain/codeReview';
import { foundObjects } from './foundObjects';
import { integerValue } from './formatRecords';

/** A review as `cm find review` reports it; branch targets come as object ids (`id:54`) to be resolved. */
export interface RawCodeReview extends CodeReviewSummary {
  targetType: 'branch' | 'changeset' | 'shelve' | 'other';
  /** Branch object id, changeset or shelve number. */
  targetId: number;
}

export const FOUND_REVIEWS = foundObjects(
  'review',
  ['id', 'title', 'codereviewstatus', 'status', 'owner', 'assignee', 'date', 'targettype', 'target'],
  (value): RawCodeReview => ({
    id: integerValue(value('id')),
    title: value('title'),
    status: toStatus(value('codereviewstatus') || value('status')),
    owner: value('owner'),
    assignee: value('assignee'),
    date: value('date'),
    targetType: toTargetType(value('targettype')),
    targetId: integerValue(value('target').replace(/^id:/, '')),
  }),
);

/** `cm` prefixes the value with its type name, e.g. `CodeReviewStatus Under review`. */
function toStatus(value: string): CodeReviewStatus {
  const status = value.replace(/^(CodeReviewStatus|Status)\s+/, '');
  return CODE_REVIEW_STATUSES.find((known) => known.toLowerCase() === status.toLowerCase()) ?? 'Under review';
}

function toTargetType(value: string): RawCodeReview['targetType'] {
  const type = value.toLowerCase();
  return type === 'branch' || type === 'changeset' || type === 'shelve' ? type : 'other';
}
