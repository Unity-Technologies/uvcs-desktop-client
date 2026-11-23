import type { CommentParts } from '../../../lib/comment';

/** What a thread's answer box holds open under its comments: a reply, or a discard of its change request saying why. */
export type Answering = 'reply' | 'discard';

/** The answer box under a thread: which composer is open, if any, and whether it takes the focus as it opens. */
export interface AnswerBox {
  answering: Answering | null;
  /** Opened by the user's click: the cursor goes to it. One opened again for its draft leaves the focus where it is. */
  focuses: boolean;
}

/**
 * What a draft holds, as far as the box cares: nothing kept, a draft emptied (or only spaces), or words. Its text
 * itself never matters here, so typing doesn't make every card showing the thread render again.
 */
export type AnswerDraft = 'none' | 'empty' | 'words';

/** The thread's drafts left unsent (`useCommentDraftStore`, under `commentDraftKey`'s `reviewReply` and `reviewDiscard`). */
export interface AnswerDrafts {
  reply: AnswerDraft;
  discard: AnswerDraft;
}

export function answerDraftOf(draft: CommentParts | undefined): AnswerDraft {
  if (draft === undefined) return 'none';
  return draft.description.trim() === '' ? 'empty' : 'words';
}

/**
 * How the answer box shows as its thread mounts again (another tab, file or view, and back): the composer left with
 * words in it, open with them, so the draft doesn't look lost behind the "Reply…" prompt. The reply wins when both were
 * left, as the box shows one at a time; a discard only while the user may still discard (`canDiscard`).
 */
export function answerShownOnReturn(drafts: AnswerDrafts, discardable: boolean): AnswerBox {
  if (drafts.reply === 'words') return { answering: 'reply', focuses: false };
  if (discardable && drafts.discard === 'words') return { answering: 'discard', focuses: false };
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
 * cancelled) closes the box it was open in, unless the focus is in it, and the box then shows what coming back would
 * (`answerShownOnReturn`): a discard still left, or the prompt. A box opened by hand and still empty has never held a
 * draft, so it stays open.
 */
export function nextAnswerBox(box: AnswerBox, seen: AnswerDrafts, drafts: AnswerDrafts, discardable: boolean, focused: boolean): AnswerBox {
  if (box.answering === null) {
    const shown = answerShownOnReturn(drafts, discardable);
    return shown.answering === null ? box : shown;
  }
  const forgotten = seen[box.answering] !== 'none' && drafts[box.answering] === 'none';
  return forgotten && !focused ? answerShownOnReturn(drafts, discardable) : box;
}

/** The box, and the drafts it last followed: what a draft "forgotten" is measured against. */
export interface AnswerFollowing {
  box: AnswerBox;
  seen: AnswerDrafts;
}

/**
 * One step of following the drafts (`nextAnswerBox`), remembering them for the next. `unfolds` when words written
 * elsewhere open a closed box, so a folded card shows it (`ThreadCardFoldEvent`'s `unfold`). Nothing changed gives
 * back the same object, so the card doesn't render again.
 */
export function followDrafts(following: AnswerFollowing, drafts: AnswerDrafts, discardable: boolean, focused: boolean): { following: AnswerFollowing; unfolds: boolean } {
  const box = nextAnswerBox(following.box, following.seen, drafts, discardable, focused);
  const unfolds = following.box.answering === null && box.answering !== null;
  if (box === following.box && sameDrafts(following.seen, drafts)) return { following, unfolds };
  return { following: { box, seen: drafts }, unfolds };
}

function sameDrafts(a: AnswerDrafts, b: AnswerDrafts): boolean {
  return a.reply === b.reply && a.discard === b.discard;
}
