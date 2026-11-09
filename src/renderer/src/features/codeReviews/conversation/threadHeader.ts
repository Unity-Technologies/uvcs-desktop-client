import type { ReviewThread } from './reviewThreads';
import { answerOf, appliedPillTip, locationText, repliesText, threadBadges, threadKindName, writtenLineText, type ThreadBadges } from './threadBadges';

/**
 * Where a thread's card is: the conversation's timeline, the code of the Changes tab (`ThreadInCode`), or the Comments
 * panel, whose whole card goes to the thread (`ThreadSummaryCard`).
 */
export type ThreadCardPlace = 'conversation' | 'code' | 'panel';

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
  /** Whether "Applied" shows how it was applied, in context, rather than opening the changeset. */
  seesHowApplied: boolean;
  /** Whether "Answered" can show the reply that answered (the panel's card can't: it goes to the thread). */
  showsAnswer: boolean;
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
export type HeaderPill = NonNullable<ThreadBadges['state']> & ({ leadsTo: 'nothing' } | { leadsTo: 'answer'; tip: string } | { leadsTo: 'applied'; changesetId: number; tip: string });

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
  pill: HeaderPill | null;
  hides: boolean;
}

/** Whether a thread's card has a header band: one on a line, a change request, or a question. A plain review comment has none. */
export function hasThreadHeader(thread: ReviewThread): boolean {
  return thread.root.anchor.kind === 'line' || threadBadges(thread).kind !== undefined;
}

export function threadHeaderOf({ thread, place, folded, foldable, earlier, hides, seesHowApplied, showsAnswer }: ThreadHeaderInput): ThreadHeaderView {
  const badges = threadBadges(thread);
  const inCode = place === 'code';
  return {
    foldToggle: foldable ? { expanded: !folded, label: folded ? 'Show the thread' : 'Fold the thread' } : null,
    kindIcon: badges.kind !== undefined || inCode,
    // In the code, the thread is at its line: its location would name where the user already is.
    location: inCode ? null : locationOf(thread, place === 'panel'),
    kindLabel: inCode ? threadKindName(thread.root) : null,
    earlierTag: inCode && earlier ? earlier : null,
    replies: folded ? (repliesText(thread) ?? null) : null,
    pill: pillOf(thread, badges, seesHowApplied, showsAnswer),
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

function pillOf(thread: ReviewThread, badges: ThreadBadges, seesHowApplied: boolean, showsAnswer: boolean): HeaderPill | null {
  if (!badges.state) return null;
  const answer = showsAnswer ? answerOf(thread) : undefined;
  if (answer) return { ...badges.state, leadsTo: 'answer', tip: answer.tip };
  if (badges.appliedIn !== undefined) return { ...badges.state, leadsTo: 'applied', changesetId: badges.appliedIn, tip: appliedPillTip(badges.appliedIn, seesHowApplied) };
  return { ...badges.state, leadsTo: 'nothing' };
}
