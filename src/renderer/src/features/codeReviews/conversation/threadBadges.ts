import type { ReviewComment, ReviewCommentAnchor, ReviewCommentKind } from '@shared/domain/reviewConversation';
import type { PageOf } from '../../../app/navigation/pages';
import { anchorPath } from '../inline/fileThreads';
import type { ReviewThread } from './reviewThreads';

/** What a thread's header says of it: its kind (none for a plain or general comment) and where it stands. */
export interface ThreadBadges {
  kind?: 'Change request' | 'Question';
  /** Open takes the color of what's still asked; resolved (applied, answered) of what's done; discarded stays neutral. */
  state?: { label: string; tone: 'open' | 'resolved' | 'discarded' };
  /** The changeset that applied a change request, in its pill, opening it: "Applied in cs:4". */
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
      return { kind, state: { label: 'Discarded', tone: 'discarded' } };
    case 'none':
      return kind ? { kind } : {};
  }
}

/** What a reply's header says after its author's name: a discard says so. */
export function replyAction(reply: Pick<ReviewComment, 'kind'>): string | undefined {
  return reply.kind === 'discard' ? 'discarded it' : undefined;
}

/** What a thread on a line is, named: a change request, a question, or a plain comment. */
export function threadKindName(root: Pick<ReviewComment, 'kind'>): 'Change request' | 'Question' | 'Comment' {
  return root.kind === 'changeRequest' ? 'Change request' : root.kind === 'question' ? 'Question' : 'Comment';
}

/**
 * What the file of a comment on a line reads: its folder, which gives way first in a narrow card, and its name, whole.
 * The line goes apart (`writtenLineText`).
 */
export function locationText(anchor: Pick<Extract<ReviewCommentAnchor, { kind: 'line' }>, 'path'>): { folder: string; file: string } {
  const path = anchorPath(anchor);
  const slash = path.lastIndexOf('/');
  return { folder: path.slice(0, slash + 1), file: path.slice(slash + 1) };
}

/** The line a comment was written on, as the conversation says it apart from its file's link: "line 42". */
export function writtenLineText(anchor: Pick<Extract<ReviewCommentAnchor, { kind: 'line' }>, 'line'>): string {
  return `line ${anchor.line}`;
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
 * The review on its Changes tab at a thread: its file (the diff names files without the leading slash), in the mode it
 * was written in (a branch's diff opens on the changeset of one written changeset by changeset), the diff scrolled to
 * the thread wherever the file has it: at its line, or above the code when written on an earlier version whose line
 * changed since.
 */
export function commentLocationPage(reviewId: number, root: Pick<ReviewComment, 'id' | 'changesetId'> & { anchor: Extract<ReviewCommentAnchor, { kind: 'line' }> }): PageOf<'codeReview'> {
  const page: PageOf<'codeReview'> = { kind: 'codeReview', reviewId, tab: 'changes', focusPath: anchorPath(root.anchor), focusThread: root.id };
  return root.changesetId === undefined ? page : { ...page, focusChangeset: root.changesetId };
}
