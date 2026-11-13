import type { ReviewThread } from './reviewThreads';
import { answerOf, appliedPillTip, locationText, repliesText, threadBadges, threadKindName, writtenLineText, type ThreadBadges } from './threadBadges';

/**
 * Where a thread's card is: the conversation's timeline, the code of the Changes tab (`ThreadInCode`), or the Comments
 * panel, whose whole card goes to the thread (`ThreadSummaryCard`): alone in a time order (`panel`), or under its
 * file's name in the code order (`fileGroup`, `ThreadSummaryRow`), where its line stands apart.
 */
export type ThreadCardPlace = 'conversation' | 'code' | 'panel' | 'fileGroup';

/** What the card can do from its header, which decides what the header offers. */
export interface ThreadHeaderInput {
  thread: ReviewThread;
  place: ThreadCardPlace;
  folded: boolean;
  /** A settled thread folds and unfolds from its header; the panel's cards stay folded. */
  foldable: boolean;
  /** In the code, written on an earlier version (`earlierTagOf`), and whether its tag shows it in context. */
  earlier?: { label: string; tip: string; opensContext: boolean };
  /** The × that folds it back to its line's marker, while comments are hidden in the code. */
  hides: boolean;
  /**
   * Whether the card shows a settled request in context (`CommentContextDialog`): "Applied" how it was applied, rather
   * than opening the changeset, and "Discarded" what it asked against the newest version, beside the reply.
   */
  seesHowApplied: boolean;
  /** Whether "Answered" can show the reply that answered (the panel's card can't: it goes to the thread). */
  showsAnswer: boolean;
  /**
   * Shown in context (`CommentContextDialog`), which is how it was applied itself: "Applied" names its changeset and
   * leads nowhere, as opening the changeset would go behind the dialog (its footer opens it, closing the dialog).
   */
  inContext: boolean;
}

/** The file and line a header names: a link to it in Changes, or, on a card that goes there itself, text. */
export interface HeaderLocation {
  folder: string;
  file: string;
  /** "line 42", apart from the file: the line it was written on, which an outdated comment's no longer is. */
  line: string;
  linked: boolean;
  /** The text's tooltip, the whole path and line; a link's says where it goes, the path under it. */
  tip: string;
  tipSub?: string;
}

/** Where the thread stands, as a pill: "Answered" leads to the reply, "Applied" to how it was applied; the rest are words. */
export type HeaderPill = NonNullable<ThreadBadges['state']> &
  ({ leadsTo: 'nothing'; tip?: string } | { leadsTo: 'answer'; tip: string } | { leadsTo: 'applied'; changesetId: number; tip: string } | { leadsTo: 'context'; tip: string });

/** What a thread's header shows, in its order; the card maps it to its controls. */
export interface ThreadHeaderView {
  foldToggle: { expanded: boolean; label: string } | null;
  kindIcon: boolean;
  location: HeaderLocation | null;
  /** In the code, the kind named, as the location is left out there. */
  kindLabel: string | null;
  earlierTag: { label: string; tip: string; opensContext: boolean } | null;
  /** How many replies a folded thread has. */
  replies: string | null;
  /** Under its file's name, where its file isn't named: the line it was written on, "line 42". */
  line: string | null;
  pill: HeaderPill | null;
  hides: boolean;
  /**
   * The first comment's menu (`useCommentMenu`) at the header's end, after the pill: folded, the comment that has it is
   * hidden, and what it offers ("Mark as not applied", Copy, Edit, Delete) shouldn't wait for a click that unfolds it.
   * Only on a card that unfolds (the conversation's, the code's): the Comments panel's go to the thread. Never on one
   * shown whole, where the comment has it: one menu, not two.
   */
  commentMenu: boolean;
}

/** Whether a thread's card has a header band: one on a line, a change request, or a question. A plain review comment has none. */
export function hasThreadHeader(thread: ReviewThread): boolean {
  return thread.root.anchor.kind === 'line' || threadBadges(thread).kind !== undefined;
}

export function threadHeaderOf({ thread, place, folded, foldable, earlier, hides, seesHowApplied, showsAnswer, inContext }: ThreadHeaderInput): ThreadHeaderView {
  const badges = threadBadges(thread);
  const inCode = place === 'code';
  // Under its file, every row has the icon, so their words start in one column.
  const underFile = place === 'fileGroup';
  return {
    foldToggle: foldable ? { expanded: !folded, label: folded ? 'Show the thread' : 'Fold the thread' } : null,
    kindIcon: badges.kind !== undefined || inCode || underFile,
    // In the code, the thread is at its line: its location would name where the user already is. Under its file's
    // name, the file is named already.
    location: inCode || underFile ? null : locationOf(thread, place === 'panel'),
    kindLabel: inCode ? threadKindName(thread.root) : null,
    earlierTag: inCode && earlier ? earlier : null,
    replies: folded ? (repliesText(thread) ?? null) : null,
    line: underFile && thread.root.anchor.kind === 'line' ? writtenLineText(thread.root.anchor) : null,
    pill: pillOf(thread, badges, seesHowApplied, showsAnswer, inContext),
    hides: inCode && hides,
    commentMenu: folded && (place === 'conversation' || inCode),
  };
}

function locationOf({ root }: ReviewThread, cardOpens: boolean): HeaderLocation | null {
  if (root.anchor.kind !== 'line') return null;
  const { folder, file } = locationText(root.anchor);
  const line = writtenLineText(root.anchor);
  // The panel's card goes to the thread: its file and line only name where, whole in the tooltip.
  return cardOpens ? { folder, file, line, linked: false, tip: `${folder}${file}, ${line}` } : { folder, file, line, linked: true, tip: 'Show in Changes', tipSub: `${folder}${file}` };
}

function pillOf(thread: ReviewThread, badges: ThreadBadges, seesHowApplied: boolean, showsAnswer: boolean, inContext: boolean): HeaderPill | null {
  if (!badges.state) return null;
  const answer = showsAnswer ? answerOf(thread) : undefined;
  // A question answered in a changeset ("Fixed in cs:281301") leads to how, as an applied request does.
  if (thread.state.kind === 'answered' && thread.state.changesetId !== undefined) {
    const { changesetId } = thread.state;
    if (inContext) return { ...badges.state, leadsTo: 'nothing', tip: `Answered in changeset ${changesetId}` };
    if (seesHowApplied) return { ...badges.state, leadsTo: 'context', tip: `Answered in changeset ${changesetId}: see how it was answered` };
  }
  if (answer) return { ...badges.state, leadsTo: 'answer', tip: answer.tip };
  if (badges.appliedIn !== undefined && inContext) return { ...badges.state, leadsTo: 'nothing', tip: `Applied in changeset ${badges.appliedIn}` };
  if (badges.appliedIn !== undefined) return { ...badges.state, leadsTo: 'applied', changesetId: badges.appliedIn, tip: appliedPillTip(badges.appliedIn, seesHowApplied) };
  // Every settled pill that leads somewhere else leads to the thread in context: Discarded, and Answered where the card
  // can't show its answer (the Comments panel's).
  if ((thread.state.kind === 'discarded' || thread.state.kind === 'answered') && seesHowApplied && !inContext) {
    return { ...badges.state, leadsTo: 'context', tip: `${badges.state.label}: see it in context` };
  }
  return { ...badges.state, leadsTo: 'nothing' };
}
