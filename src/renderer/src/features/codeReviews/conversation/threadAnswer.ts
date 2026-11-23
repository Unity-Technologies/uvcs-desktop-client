import type { CommentParts } from '../../../lib/comment';

/** What a thread's answer box holds open under its comments: a reply, or a discard of its change request saying why. */
export type Answering = 'reply' | 'discard';

/** The answer box under a thread: which composer is open, if any, and whether it takes the focus as it opens. */
export interface AnswerBox {
  answering: Answering | null;
  /** Opened by the user's click: the cursor goes to it. One opened again for its draft leaves the focus where it is. */
  focuses: boolean;
}

/** The thread's drafts left unsent (`useCommentDraftStore`, under `commentDraftKey`'s `reviewReply` and `reviewDiscard`). */
export interface AnswerDrafts {
  reply: CommentParts | undefined;
  discard: CommentParts | undefined;
}

/** Whether a draft holds words: one emptied (or only spaces) is nothing to come back to. */
function keepsAnswerDraft(draft: CommentParts | undefined): boolean {
  return draft !== undefined && draft.description.trim() !== '';
}

/**
 * How the answer box shows as its thread mounts again (another tab, file or view, and back): the composer left with
 * words in it, open with them, so the draft doesn't look lost behind the "Reply…" prompt. The reply wins when both were
 * left, as the box shows one at a time; a discard only while the user may still discard (`canDiscard`).
 */
export function answerShownOnReturn(drafts: AnswerDrafts, discardable: boolean): AnswerBox {
  if (keepsAnswerDraft(drafts.reply)) return { answering: 'reply', focuses: false };
  if (discardable && keepsAnswerDraft(drafts.discard)) return { answering: 'discard', focuses: false };
  return { answering: null, focuses: false };
}

/** The composer the user opened ("Reply…", "Discard…"): it takes the focus. */
export function answerOpenedByHand(answering: Answering): AnswerBox {
  return { answering, focuses: true };
}

/**
 * How the box follows the drafts as they change while its card is mounted: the same thread shows in both of a review's
 * tabs, kept mounted, and in an image's or model's popover. A draft that starts holding words elsewhere (or a discard
 * once the user is known and may discard) opens the closed box, without the focus. A draft forgotten elsewhere (sent or
 * cancelled) closes the box it was open in, unless the focus is in it. A box opened by hand and still empty has never
 * held a draft, so it stays open.
 */
export function nextAnswerBox(box: AnswerBox, previous: AnswerDrafts, drafts: AnswerDrafts, discardable: boolean, focused: boolean): AnswerBox {
  if (box.answering === null) {
    const shown = answerShownOnReturn(drafts, discardable);
    return shown.answering === null ? box : shown;
  }
  const forgotten = previous[box.answering] !== undefined && drafts[box.answering] === undefined;
  return forgotten && !focused ? { answering: null, focuses: false } : box;
}
