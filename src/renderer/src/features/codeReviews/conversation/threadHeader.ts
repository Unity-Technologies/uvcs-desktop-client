import type { ReviewThread } from './reviewThreads';
import { answerOf, appliedPillTip, locationText, repliesText, threadBadges, threadKindName, writtenLineText, type ThreadBadges, type ThreadKindName } from './threadBadges';

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

/**
 * What the thread is and where it stands, as a pill on the band's right, where the eye goes: its kind's icon
 * (`THREAD_KIND_ICONS`, its own tooltip naming the kind) says what it is, so every thread names its kind in one spot,
 * and its words say only where it stands: Open, Applied, Discarded, Answered. A plain comment on a line stands nowhere:
 * its pill says "Comment", in a tone of its own (`comment`) that no state takes, a muted violet.
 * "Answered" leads to the reply, "Applied" to how it was applied; the rest are words.
 */
export type HeaderPill = {
  kind: ThreadKindName;
  /**
   * The kind's name, the icon's tooltip and what a screen reader says of it; null where the label names the kind
   * already ("Comment"), so it isn't said twice: the icon is then only drawn.
   */
  kindTip: ThreadKindName | null;
  label: string;
  tone: PillTone;
} &
  ({ leadsTo: 'nothing'; tip?: string } | { leadsTo: 'answer'; tip: string } | { leadsTo: 'applied'; changesetId: number; tip: string } | { leadsTo: 'context'; tip: string });

/** The pill's color: open amber, done green, discarded gray, a plain comment violet, as no state is. */
export type PillTone = NonNullable<ThreadBadges['state']>['tone'] | 'comment';

/** What a thread's header shows, in its order; the card maps it to its controls. */
export interface ThreadHeaderView {
  foldToggle: { expanded: boolean; label: string } | null;
  location: HeaderLocation | null;
  earlierTag: { label: string; tip: string; opensContext: boolean } | null;
  /** How many replies a folded thread has. */
  replies: string | null;
  /** Under its file's name, where its file isn't named: the line it was written on, "line 42". */
  line: string | null;
  pill: HeaderPill | null;
  hides: boolean;
}

/** Whether a thread's card has a header band: one on a line, a change request, or a question. A plain review comment has none. */
export function hasThreadHeader(thread: ReviewThread): boolean {
  return thread.root.anchor.kind === 'line' || threadBadges(thread).kind !== undefined;
}

export function threadHeaderOf({ thread, place, folded, foldable, earlier, hides, seesHowApplied, showsAnswer, inContext }: ThreadHeaderInput): ThreadHeaderView {
  const badges = threadBadges(thread);
  const inCode = place === 'code';
  const underFile = place === 'fileGroup';
  return {
    foldToggle: foldable ? { expanded: !folded, label: folded ? 'Show the thread' : 'Fold the thread' } : null,
    // In the code, the thread is at its line: its location would name where the user already is. Under its file's
    // name, the file is named already.
    location: inCode || underFile ? null : locationOf(thread, place === 'panel'),
    earlierTag: inCode && earlier ? earlier : null,
    replies: folded ? (repliesText(thread) ?? null) : null,
    line: underFile && thread.root.anchor.kind === 'line' ? writtenLineText(thread.root.anchor) : null,
    pill: pillOf(thread, badges, seesHowApplied, showsAnswer, inContext),
    hides: inCode && hides,
  };
}

function locationOf({ root }: ReviewThread, cardOpens: boolean): HeaderLocation | null {
  if (root.anchor.kind !== 'line') return null;
  const { folder, file } = locationText(root.anchor);
  const line = writtenLineText(root.anchor);
  // The panel's card goes to the thread: its file and line only name where, whole in the tooltip.
  return cardOpens ? { folder, file, line, linked: false, tip: `${folder}${file}, ${line}` } : { folder, file, line, linked: true, tip: 'Show in Changes', tipSub: `${folder}${file}` };
}

/** How the pill looks: the thread's kind (its icon) and where it stands, or, for a plain comment, that it is one. */
function pillLook(thread: ReviewThread, badges: ThreadBadges): Pick<HeaderPill, 'kind' | 'kindTip' | 'label' | 'tone'> | null {
  const kind = threadKindName(thread.root);
  if (!badges.state) return hasThreadHeader(thread) ? { kind, kindTip: null, label: kind, tone: 'comment' } : null;
  return { kind, kindTip: kind, ...badges.state };
}

function pillOf(thread: ReviewThread, badges: ThreadBadges, seesHowApplied: boolean, showsAnswer: boolean, inContext: boolean): HeaderPill | null {
  const look = pillLook(thread, badges);
  if (!look) return null;
  const answer = showsAnswer ? answerOf(thread) : undefined;
  // A question answered in a changeset ("Fixed in cs:281301") leads to how, as an applied request does.
  if (thread.state.kind === 'answered' && thread.state.changesetId !== undefined) {
    const { changesetId } = thread.state;
    if (inContext) return { ...look, leadsTo: 'nothing', tip: `Answered in changeset ${changesetId}` };
    if (seesHowApplied) return { ...look, leadsTo: 'context', tip: `Answered in changeset ${changesetId}: see how it was answered` };
  }
  if (answer) return { ...look, leadsTo: 'answer', tip: answer.tip };
  if (badges.appliedIn !== undefined && inContext) return { ...look, leadsTo: 'nothing', tip: `Applied in changeset ${badges.appliedIn}` };
  if (badges.appliedIn !== undefined) return { ...look, leadsTo: 'applied', changesetId: badges.appliedIn, tip: appliedPillTip(badges.appliedIn, seesHowApplied) };
  // Every settled pill that leads somewhere else leads to the thread in context: Discarded, and Answered where the card
  // can't show its answer (the Comments panel's).
  if ((thread.state.kind === 'discarded' || thread.state.kind === 'answered') && seesHowApplied && !inContext) {
    return { ...look, leadsTo: 'context', tip: `${look.label}: see it in context` };
  }
  return { ...look, leadsTo: 'nothing' };
}
