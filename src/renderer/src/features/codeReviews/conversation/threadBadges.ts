import type { FileAnchor, ImageSpot, ModelSpot, ReviewComment, ReviewCommentKind } from '@shared/domain/reviewConversation';
import type { PageOf } from '../../../app/navigation/pages';
import { displayName } from '../../../lib/userName';
import { anchorPath } from '../inline/fileThreads';
import { rangeWordsInline } from '../../../lib/rangeWords';
import type { ReviewThread } from './reviewThreads';

/** What a thread's header says of it: its kind (none for a plain or general comment) and where it stands. */
export interface ThreadBadges {
  kind?: 'Change request' | 'Question';
  /** Open takes the color of what's still asked; resolved (applied, answered) of what's done; discarded stays neutral. */
  state?: { label: string; tone: 'open' | 'resolved' | 'discarded' };
  /**
   * The changeset that applied a change request: its pill, "Applied", opens how it was applied, and its tooltip names
   * the changeset (`appliedPillTip`).
   */
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
      return { kind, state: { label: 'Applied', tone: 'resolved' }, appliedIn: state.changesetId };
    case 'discarded':
      return { kind, state: { label: 'Discarded', tone: 'discarded' } };
    case 'none':
      return kind ? { kind } : {};
  }
}

/** What an Applied pill's tooltip says: the changeset that applied it, and what a click shows of it. */
export function appliedPillTip(changesetId: number, seesHowApplied: boolean): string {
  return `Applied in changeset ${changesetId}: ${seesHowApplied ? 'see how it was applied' : 'open it'}`;
}

/**
 * The reply an Answered pill leads to: the first, as any reply answers a question (`threadState`), with the pill's
 * tooltip naming who wrote it. None for a thread not answered.
 */
export function answerOf({ state, replies }: Pick<ReviewThread, 'state' | 'replies'>): { replyId: number; tip: string } | undefined {
  const answer = state.kind === 'answered' ? replies[0] : undefined;
  return answer && { replyId: answer.id, tip: `Answered by ${displayName(answer.author)}: see the answer` };
}

/** What a reply's header says after its author's name: a discard says so. */
export function replyAction(reply: Pick<ReviewComment, 'kind'>): string | undefined {
  return reply.kind === 'discard' ? 'discarded it' : undefined;
}

/** What a thread is, named: a change request, a question, or a plain comment. */
export type ThreadKindName = 'Change request' | 'Question' | 'Comment';

/** What a thread on a line is, named: a change request, a question, or a plain comment. */
export function threadKindName(root: Pick<ReviewComment, 'kind'>): ThreadKindName {
  return root.kind === 'changeRequest' ? 'Change request' : root.kind === 'question' ? 'Question' : 'Comment';
}

/**
 * What the file of a comment on a file reads: its folder, which gives way first in a narrow card, and its name, whole.
 * Where in it goes apart (`writtenPlaceText`).
 */
export function locationText(anchor: Pick<FileAnchor, 'path'>): { folder: string; file: string } {
  const path = anchorPath(anchor);
  const slash = path.lastIndexOf('/');
  return { folder: path.slice(0, slash + 1), file: path.slice(slash + 1) };
}

/**
 * Where in its file a comment was written, as the conversation says it apart from the file's link: its lines, "line
 * 42", "lines 42–48", what of an image, "point", "area", or of a 3D model, "point", "part": its pin shows where, with
 * who started it.
 */
export function writtenPlaceText(anchor: FileAnchor): string {
  switch (anchor.kind) {
    case 'line':
      return rangeWordsInline(anchor);
    case 'image':
      return imageSpotWords(anchor.spot);
    case 'model':
      return modelSpotWords(anchor.spot);
  }
}

/** What hovering where a comment was written says of it: what of its file that place is; a part's name, too. */
export function writtenPlaceTip(anchor: FileAnchor): string {
  switch (anchor.kind) {
    case 'line':
      return anchor.firstLine === anchor.lastLine ? 'The line it was written on' : 'The lines it was written on';
    case 'image':
      return `The ${imageSpotWords(anchor.spot)} of the image it was written on`;
    case 'model': {
      const part = anchor.spot.wholePart ? modelPartName(anchor.spot) : null;
      return part ? `The part of the model it was written on: ${part}` : 'The point of the model it was written on';
    }
  }
}

/** "point" for a point of an image, "area" for an area. */
export function imageSpotWords(spot: ImageSpot): string {
  return spot.size ? 'area' : 'point';
}

/** "part" for a comment on a whole part of a 3D model, "point" for one on a point of its surface. */
export function modelSpotWords(spot: ModelSpot): string {
  return spot.wholePart ? 'part' : 'point';
}

/** The name of the part a spot of a model is on: the last of its names from the root; none when it names no part. */
export function modelPartName(spot: ModelSpot): string | null {
  return spot.node?.path.at(-1) ?? null;
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
 * was written in (a branch's diff opens on the changeset of one written in its diff), the diff scrolled to
 * the thread wherever the file has it: at its line, or above the code when written on an earlier version whose line
 * changed since.
 */
export function commentLocationPage(reviewId: number, root: Pick<ReviewComment, 'id' | 'changesetId'> & { anchor: FileAnchor }): PageOf<'codeReview'> {
  const page: PageOf<'codeReview'> = { kind: 'codeReview', reviewId, tab: 'changes', focusPath: anchorPath(root.anchor), focusThread: root.id };
  return root.changesetId === undefined ? page : { ...page, focusChangeset: root.changesetId };
}
