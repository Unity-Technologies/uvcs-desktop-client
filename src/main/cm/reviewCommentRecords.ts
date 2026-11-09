import type { CodeReviewStatus } from '@shared/domain/codeReview';
import type { ReviewComment, ReviewCommentKind, ReviewConversation, ReviewEventChange } from '@shared/domain/reviewConversation';
import { foundObjects } from './foundObjects';
import { integerValue } from './formatRecords';

/** A review comment as `cm find changereviewcomment` prints it: the server's own notes (`timeline`) among them. */
export interface RawReviewComment {
  id: number;
  guid: string;
  owner: string;
  date: string;
  modifiedDate: string;
  text: string;
  /** As `cm` prints it, lower case: `comment`, `change`, `question`, `conversation`, `timeline`, `script`, `discarded`. */
  type: string;
  parentId: number;
  revisionId: number;
  itemId: number;
  path: string;
  /** 1-based; -1 when the comment isn't on a line. */
  line: number;
  changesetId: number;
  appliedInChangeset: number;
}

/**
 * Every comment of a review in one `cm find`, with what places it (`{path}`, `{itemid}`, `{line}`, `{changeset}`) and
 * what resolves it (`{parent}`, `{appliedinchangeset}`): its replies and its threads are read from the same list.
 */
export const FOUND_REVIEW_COMMENTS = foundObjects(
  'changereviewcomment',
  ['id', 'guid', 'owner', 'date', 'modifieddate', 'comment', 'type', 'parent', 'revisionid', 'itemid', 'path', 'line', 'changeset', 'appliedinchangeset'],
  (value): RawReviewComment => ({
    id: integerValue(value('id')),
    guid: value('guid'),
    owner: value('owner'),
    date: value('date'),
    modifiedDate: value('modifieddate'),
    text: value('comment'),
    type: value('type').toLowerCase(),
    parentId: integerValue(value('parent')),
    revisionId: integerValue(value('revisionid')),
    itemId: integerValue(value('itemid')),
    path: value('path'),
    line: integerValue(value('line')),
    changesetId: integerValue(value('changeset')),
    appliedInChangeset: integerValue(value('appliedinchangeset')),
  }),
);

/**
 * A review's conversation from its comments as `cm` lists them, oldest first. The server writes its own notes as
 * comments too (`timeline`), their meaning in a prefix of the text (`[status-reviewed]Looks good`): the description is
 * the newest `[description]` one, the rest are events.
 */
export function conversationOf(records: readonly RawReviewComment[]): ReviewConversation {
  const conversation: ReviewConversation = { comments: [], events: [] };
  for (const record of records) {
    if (record.type !== 'timeline') {
      conversation.comments.push(commentOf(record));
    } else if (record.text.startsWith(DESCRIPTION_PREFIX)) {
      conversation.description = {
        guid: record.guid,
        text: record.text.slice(DESCRIPTION_PREFIX.length),
        author: record.owner,
        date: record.date,
        ...editedDateOf(record),
      };
    } else {
      conversation.events.push({ id: record.id, author: record.owner, date: record.date, ...eventChangeOf(record) });
    }
  }
  return conversation;
}

const DESCRIPTION_PREFIX = '[description]';

function commentOf(record: RawReviewComment): ReviewComment {
  return {
    id: record.id,
    guid: record.guid,
    author: record.owner,
    date: record.date,
    ...editedDateOf(record),
    text: record.text,
    kind: kindOf(record),
    ...(record.parentId >= 0 && { parentId: record.parentId }),
    anchor:
      record.revisionId >= 0 && record.line > 0
        ? { kind: 'line', revisionId: record.revisionId, itemId: record.itemId, path: record.path, line: record.line }
        : { kind: 'review' },
    ...(record.changesetId >= 0 && { changesetId: record.changesetId }),
    ...(record.appliedInChangeset >= 0 && { appliedInChangeset: record.appliedInChangeset }),
  };
}

/** `{modifieddate}` prints the creation date for a comment never edited. */
function editedDateOf(record: RawReviewComment): { editedDate?: string } {
  return record.modifiedDate && record.modifiedDate !== record.date ? { editedDate: record.modifiedDate } : {};
}

/**
 * A `script` comment (a trigger's) reads as what it's on, a review's or a line's: the app writes none, and no reply
 * changes what it is.
 */
function kindOf(record: RawReviewComment): ReviewCommentKind {
  switch (record.type) {
    case 'change':
      return 'changeRequest';
    case 'question':
      return 'question';
    case 'discarded':
      return 'discard';
    case 'conversation':
      return 'general';
    case 'script':
      return record.revisionId >= 0 ? 'comment' : 'general';
    default:
      return 'comment';
  }
}

/**
 * The prefixes the server writes. The status ones end with what the reviewer said; the review requests name the
 * reviewers, separated by `;` (an older server wrote `[requested-review-from-<id>]`, which names no one readable).
 */
function eventChangeOf({ text, guid }: RawReviewComment): ReviewEventChange {
  for (const [prefix, status] of STATUS_PREFIXES) {
    if (text.startsWith(prefix)) return { kind: 'statusChanged', status, comment: text.slice(prefix.length), guid };
  }
  if (text.startsWith('[renamed-title]')) {
    const [from = '', ...to] = text.slice('[renamed-title]'.length).split(TITLE_SEPARATOR);
    return { kind: 'titleChanged', from, to: to.join(TITLE_SEPARATOR) };
  }
  if (text.startsWith('[requested-review-from]')) return { kind: 'reviewRequested', reviewers: names(text.slice('[requested-review-from]'.length)) };
  if (text.startsWith('[requested-review-from-')) return { kind: 'reviewRequested', reviewers: [] };
  if (text.startsWith('[re-requested-review-from]')) return { kind: 'reviewRequestedAgain', reviewer: text.slice('[re-requested-review-from]'.length) };
  if (text.startsWith('[removed-requested-review-from]')) return { kind: 'reviewerRemoved', reviewer: text.slice('[removed-requested-review-from]'.length) };
  return { kind: 'other', text };
}

const STATUS_PREFIXES: ReadonlyArray<readonly [string, CodeReviewStatus]> = [
  ['[status-under-review]', 'Under review'],
  ['[status-reviewed]', 'Reviewed'],
  ['[status-rework-required]', 'Rework required'],
];

const TITLE_SEPARATOR = '#->#';

function names(list: string): string[] {
  return list
    .split(';')
    .map((name) => name.trim())
    .filter(Boolean);
}
