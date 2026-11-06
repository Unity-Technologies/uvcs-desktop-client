import type { ReviewCommentAnchor, ReviewCommentKind } from '@shared/domain/reviewConversation';
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
