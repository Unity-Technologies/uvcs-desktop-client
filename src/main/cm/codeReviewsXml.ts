import { CODE_REVIEW_STATUSES, type CodeReview, type CodeReviewStatus } from '@shared/domain/codeReview';
import { findRecords } from './findObjects';
import { integer, text } from './parseXml';

/** A review as `cm find review` reports it; branch targets come as object ids (`id:54`) to be resolved. */
export interface RawCodeReview extends Omit<CodeReview, 'target'> {
  targetType: 'branch' | 'changeset' | 'other';
  /** Branch object id or changeset number. */
  targetId: number;
}

export function parseCodeReviews(xml: string): RawCodeReview[] {
  return findRecords(xml, 'REVIEW').map((record) => ({
    id: integer(record.ID),
    title: text(record.TITLE),
    status: toStatus(text(record.CODEREVIEWSTATUS) || text(record.STATUS)),
    owner: text(record.OWNER),
    assignee: text(record.ASSIGNEE),
    date: text(record.DATE),
    targetType: toTargetType(text(record.TARGETTYPE)),
    targetId: integer(text(record.TARGET).replace(/^id:/, '')),
  }));
}

/** `cm` prefixes the value with its type name, e.g. `CodeReviewStatus Under review`. */
function toStatus(value: string): CodeReviewStatus {
  const status = value.replace(/^(CodeReviewStatus|Status)\s+/, '');
  return CODE_REVIEW_STATUSES.find((known) => known.toLowerCase() === status.toLowerCase()) ?? 'Under review';
}

function toTargetType(value: string): RawCodeReview['targetType'] {
  const type = value.toLowerCase();
  return type === 'branch' || type === 'changeset' ? type : 'other';
}
