import { CODE_REVIEW_STATUSES, type CodeReviewer, type CodeReviewStatus, type CodeReviewSummary } from '@shared/domain/codeReview';
import { foundObjects } from './foundObjects';
import { integerValue } from './formatRecords';

/** A review as `cm find review` reports it; branch targets come as object ids (`id:54`) to be resolved. */
export interface RawCodeReview extends CodeReviewSummary {
  targetType: 'branch' | 'changeset' | 'shelve' | 'other';
  /** Branch object id, changeset or shelve number. */
  targetId: number;
}

/**
 * `{codereviewstatusname}` prints the status alone and always in English; `{status}` translates it and adds a prefix.
 * `{unresolvedissues}` counts the change requests neither applied nor discarded and the questions with no reply.
 */
export const FOUND_REVIEWS = foundObjects(
  'review',
  ['id', 'title', 'codereviewstatusname', 'owner', 'reviewers', 'date', 'modifieddate', 'comments', 'unresolvedissues', 'targettype', 'target'],
  (value): RawCodeReview => ({
    id: integerValue(value('id')),
    title: value('title').trim(),
    status: toStatus(value('codereviewstatusname')),
    owner: value('owner'),
    reviewers: parseReviewers(value('reviewers')),
    date: value('date'),
    lastActivity: value('modifieddate'),
    commentCount: integerValue(value('comments')),
    openIssueCount: integerValue(value('unresolvedissues')),
    targetType: toTargetType(value('targettype')),
    targetId: integerValue(value('target').replace(/^id:/, '')),
  }),
);

/**
 * `{reviewers}`: `name:Status` pairs joined by commas (`ana:Reviewed,qa-team:Under review`), empty for none. A status
 * holds no colon, so the last one ends the name, which may hold one (`ACME\tom` doesn't, an email never does).
 */
export function parseReviewers(value: string): CodeReviewer[] {
  return value
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair): CodeReviewer => {
      const colon = pair.lastIndexOf(':');
      return colon < 0 ? { name: pair, status: 'Under review' } : { name: pair.slice(0, colon), status: toStatus(pair.slice(colon + 1)) };
    });
}

function toStatus(value: string): CodeReviewStatus {
  const status = value.trim().toLowerCase();
  return CODE_REVIEW_STATUSES.find((known) => known.toLowerCase() === status) ?? 'Under review';
}

function toTargetType(value: string): RawCodeReview['targetType'] {
  const type = value.toLowerCase();
  return type === 'branch' || type === 'changeset' || type === 'shelve' ? type : 'other';
}
