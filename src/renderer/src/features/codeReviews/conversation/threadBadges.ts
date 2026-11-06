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

/** What the location of a comment on a line reads: the file's name and the line. */
export function locationText(anchor: Extract<ReviewCommentAnchor, { kind: 'line' }>): { path: string; line: string } {
  return { path: anchor.path.replace(/^\//, ''), line: `line ${anchor.line}` };
}

/**
 * The review on its Changes tab at a comment's file and line: the diff names files without the leading slash. The
 * line is the newer side's, where comments are written; one on a file the review deletes is on the older side.
 */
export function commentLocationPage(reviewId: number, anchor: Extract<ReviewCommentAnchor, { kind: 'line' }>): PageOf<'codeReview'> {
  return {
    kind: 'codeReview',
    reviewId,
    tab: 'changes',
    focusPath: anchor.path.replace(/^\//, ''),
    focusLines: { side: 'new', first: anchor.line, last: anchor.line },
  };
}
