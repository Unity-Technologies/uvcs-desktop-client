import type { ChangeRequestThread } from '@shared/domain/reviewConversation';
import { foundObjects } from './foundObjects';
import { integerValue } from './formatRecords';

/**
 * The comments a check-in's `[apply-change:…]` may name, as `cm find changereviewcomment` prints them: their review and
 * their type, so the change request among them is found with its thread (`ReviewCommentsApi.changeRequestThread`).
 */
export const FOUND_CHANGE_REQUEST_THREADS = foundObjects('changereviewcomment', ['id', 'reviewid', 'type'], (value) => ({
  id: integerValue(value('id')),
  reviewId: integerValue(value('reviewid')),
  type: value('type').toLowerCase(),
}));

const SHORT_GUID = /^[0-9a-f]{8}$/;
const WHOLE_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The `cm find` condition keeping the comments a change request is named by, as `cm checkin` matches it
 * (`applyChangeMatches`): the first eight digits of its guid, in lower case, start it (the server takes `like` on a
 * guid); a whole guid, in any case, is it. Anything else names no request and reaches no query: the text comes from a
 * comment.
 */
export function changeRequestGuidCondition(guid: string): string | undefined {
  if (SHORT_GUID.test(guid)) return `guid like '${guid}%'`;
  if (WHOLE_GUID.test(guid)) return `guid = '${guid.toLowerCase()}'`;
  return undefined;
}

/**
 * The change request among the comments found as its review and its thread: its own id, a change request being the
 * first comment of its thread. The query keeps only `type = 'change'`; checked again here, as the server owns the query.
 * When two requests share the eight digits, the first the server prints is taken: `cm checkin` meets the same
 * ambiguity, and a whole guid names one.
 */
export function changeRequestThreadOf(records: readonly { id: number; reviewId: number; type: string }[]): ChangeRequestThread | null {
  const request = records.find((record) => record.type === 'change');
  return request ? { reviewId: request.reviewId, threadId: request.id } : null;
}
