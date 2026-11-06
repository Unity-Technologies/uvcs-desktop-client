import type { ReviewComment, ReviewCommentAnchor, ReviewCommentKind } from '@shared/domain/reviewConversation';
import type { PageOf } from '../../../app/navigation/pages';
import type { ReviewThread } from './reviewThreads';

/** What a thread's header says of it: its kind (none for a plain or general comment) and where it stands. */
export interface ThreadBadges {
  kind?: 'Change request' | 'Question';
  state?: { label: string; tone: 'open' | 'resolved' };
  /** The changeset that applied a change request, shown as a chip that opens it. */
  appliedIn?: number;
}

const KIND_LABELS: Partial<Record<ReviewCommentKind, ThreadBadges['kind']>> = { changeRequest: 'Change request', question: 'Question' };

export function threadBadges({ root, state }: ReviewThread): ThreadBadges {
  const kind = KIND_LABELS[root.kind];
  switch (state.kind) {
    case 'open':
      return { kind, state: { label: 'Open', tone: 'open' } };
    case 'answered':
      return { kind, state: { label: 'Answered', tone: 'resolved' } };
    case 'applied':
      return { kind, state: { label: 'Applied in', tone: 'resolved' }, appliedIn: state.changesetId };
    case 'discarded':
      return { kind, state: { label: 'Discarded', tone: 'resolved' } };
    case 'none':
      return kind ? { kind } : {};
  }
}

/** What a reply's header says after its author's name: a discard says so. */
export function replyAction(reply: Pick<ReviewComment, 'kind'>): string | undefined {
  return reply.kind === 'discard' ? 'discarded it' : undefined;
}

/** What an open thread is in the list of what's still open: its icon and what a screen reader calls it. */
export function openItemKind(root: Pick<ReviewComment, 'kind'>): 'Question' | 'Change request' {
  return root.kind === 'question' ? 'Question' : 'Change request';
}

/**
 * What the location of a comment on a line reads: its folder, which gives way first in a narrow card, its file's name,
 * whole, and the line.
 */
export function locationText(anchor: Extract<ReviewCommentAnchor, { kind: 'line' }>): { folder: string; file: string; line: string } {
  const path = anchor.path.replace(/^\//, '');
  const slash = path.lastIndexOf('/');
  return { folder: path.slice(0, slash + 1), file: path.slice(slash + 1), line: `:${anchor.line}` };
}

/**
 * Whether a thread starts folded to one line: once it's settled (a change request applied or discarded, a question
 * answered), so what's still open stands out and a long review reads short. Open threads and plain comments show whole.
 */
export function startsFolded({ state }: Pick<ReviewThread, 'state'>): boolean {
  return state.kind === 'applied' || state.kind === 'discarded' || state.kind === 'answered';
}

/** What a folded thread says after its location: how many replies it has, when it has any. */
export function repliesText({ replies }: Pick<ReviewThread, 'replies'>): string | undefined {
  if (replies.length === 0) return undefined;
  return replies.length === 1 ? '1 reply' : `${replies.length} replies`;
}

/**
 * The review on its Changes tab at a comment's file: the diff names files without the leading slash. Its line is
 * selected on the newer side when the comment was written in the whole review's diff; one written in a single
 * changeset's diff opens on its file only, as the whole diff's lines may not be that changeset's. A comment on an
 * older revision of the file, or on a file the review deletes, still opens at its line number in the newest version:
 * placing it exactly needs the diff's revisions, which the Changes tab reads.
 */
export function commentLocationPage(reviewId: number, anchor: Extract<ReviewCommentAnchor, { kind: 'line' }>, changesetId: number | undefined): PageOf<'codeReview'> {
  const focusPath = anchor.path.replace(/^\//, '');
  const page: PageOf<'codeReview'> = { kind: 'codeReview', reviewId, tab: 'changes', focusPath };
  return changesetId === undefined ? { ...page, focusLines: { side: 'new', first: anchor.line, last: anchor.line } } : page;
}
