import type { Changeset } from '@shared/domain/changeset';
import type { CodeReviewStatus } from '@shared/domain/codeReview';
import type { ReviewConversation, ReviewEvent } from '@shared/domain/reviewConversation';
import { sameUser } from '../../../lib/userName';
import type { ReviewedUpTo } from '../../diff/branchChangesetRows';
import { isLineThread } from '../inline/fileThreads';
import { changesetIdsOf, foldReviewerChanges, threadsOf, timelineOf, type ReviewThread, type TimelineEntry, type TimelineItem } from '../conversation/reviewThreads';

/**
 * Review rounds: a reviewer's status (Reviewed or Rework required) closes a round. Everything up to it is reviewed for
 * them; what came after is new. Worked out from the conversation and the branch's changesets alone, never kept apart:
 * the server's own notes of each status say when it was given (docs/features/code-reviews.md "Rounds").
 */

/** The statuses that close a round: Under review is a request (asked again), not a review given. */
export type RoundStatus = Exclude<CodeReviewStatus, 'Under review'>;

/** A status that closed a round: who gave it, which, when, and the server's note of it. */
export interface ClosingStatus {
  eventId: number;
  reviewer: string;
  status: RoundStatus;
  date: string;
  /** What the reviewer said with it. */
  comment: string;
}

/**
 * Whose statuses split the conversation into rounds: a reviewer's own, once they gave one (their rounds, and what's new
 * since theirs); everyone's for anyone else (the author, a bystander), who reads every reviewer's rounds.
 */
export interface RoundStatuses {
  whose: 'own' | 'everyone';
  statuses: ClosingStatus[];
}

/**
 * Where a reviewer left off: their newest status that closes a round, and the newest changeset on the branch then (none
 * for a review of a changeset or a shelve, or a status given before the branch's first changeset). A changeset checked
 * in while they were still reading counts as reviewed: the server notes when a status was given, not what was read.
 */
export interface ReviewCheckpoint {
  date: string;
  status: RoundStatus;
  changesetId?: number;
}

export function roundStatusesOf(events: readonly ReviewEvent[], user: string | undefined): RoundStatuses {
  const closing = events.flatMap((event): ClosingStatus[] =>
    event.kind === 'statusChanged' && event.status !== 'Under review' ? [{ eventId: event.id, reviewer: event.author, status: event.status, date: event.date, comment: event.comment }] : [],
  );
  closing.sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.eventId - b.eventId);
  const own = user === undefined ? [] : closing.filter((status) => sameUser(status.reviewer, user));
  return own.length > 0 ? { whose: 'own', statuses: own } : { whose: 'everyone', statuses: closing };
}

/** The user's checkpoint, or none before they closed a round. `changesets` newest first, as the page reads them. */
export function checkpointOf(events: readonly ReviewEvent[], user: string | undefined, changesets: readonly Changeset[] | undefined): ReviewCheckpoint | undefined {
  const { whose, statuses } = roundStatusesOf(events, user);
  const last = statuses.at(-1);
  if (whose !== 'own' || !last) return undefined;
  const at = Date.parse(last.date);
  const changeset = changesets?.find((candidate) => Date.parse(candidate.date) <= at);
  return { date: last.date, status: last.status, ...(changeset && { changesetId: changeset.id }) };
}

/**
 * What Changes marks against: the user's own checkpoint once they gave a status; for anyone who gave none (the author,
 * a bystander), the newest reviewer's, naming them, so they see what that reviewer has seen. None before anyone did.
 */
export function reviewedUpToOf(events: readonly ReviewEvent[], user: string | undefined, changesets: readonly Changeset[] | undefined): ReviewedUpTo | undefined {
  const { whose, statuses } = roundStatusesOf(events, user);
  const last = statuses.at(-1);
  if (!last) return undefined;
  const at = Date.parse(last.date);
  const changeset = changesets?.find((candidate) => Date.parse(candidate.date) <= at);
  return { date: last.date, ...(changeset && { changesetId: changeset.id }), ...(whose === 'everyone' && { by: last.reviewer }) };
}

/**
 * When a thread settled: its applying changeset's date, its discard's, its first answer's. None while it's open, for a
 * comment that never is, or for one applied in a changeset the branch's list doesn't hold (`settledAfter` tells that one
 * by number).
 */
export function settledDateOf(thread: ReviewThread, changesets: readonly Changeset[] | undefined): string | undefined {
  switch (thread.state.kind) {
    case 'applied': {
      const { changesetId } = thread.state;
      return changesets?.find((changeset) => changeset.id === changesetId)?.date;
    }
    case 'discarded':
      return thread.replies.find((reply) => reply.kind === 'discard')?.date;
    case 'answered':
      return thread.replies[0]?.date;
    default:
      return undefined;
  }
}

/** Whether a thread settled after the checkpoint; an applying changeset the list misses by its number against it. */
function settledAfter(thread: ReviewThread, checkpoint: ReviewCheckpoint, changesets: readonly Changeset[] | undefined): boolean {
  const settled = settledDateOf(thread, changesets);
  if (settled !== undefined) return Date.parse(settled) > Date.parse(checkpoint.date);
  // Changeset numbers grow with time in a repository: one past the checkpoint's came after it.
  return thread.state.kind === 'applied' && checkpoint.changesetId !== undefined && thread.state.changesetId > checkpoint.changesetId;
}

/**
 * The threads new to the user since their checkpoint: settled since, or with something someone else said after it (a
 * new comment, a reply). What they said themselves is no news to them.
 */
export function newThreadIds(threads: readonly ReviewThread[], checkpoint: ReviewCheckpoint, user: string | undefined, changesets: readonly Changeset[] | undefined): Set<number> {
  const after = Date.parse(checkpoint.date);
  const saidByOthers = (thread: ReviewThread): boolean =>
    [thread.root, ...thread.replies].some((comment) => Date.parse(comment.date) > after && (user === undefined || !sameUser(comment.author, user)));
  return new Set(threads.filter((thread) => settledAfter(thread, checkpoint, changesets) || saidByOthers(thread)).map((thread) => thread.root.id));
}

/** Changesets checked in one after another, by one person, with nothing said between them: one entry of the timeline. */
export interface CheckinsEntry {
  kind: 'checkins';
  owner: string;
  /** Oldest first, as the timeline reads. */
  changesets: Changeset[];
  /**
   * Whether it starts listing its changesets: under the "Since last review" line, what the reviewer comes back to check,
   * yes; anywhere else (a closed round, the author's view, a first review) folded to its line, which says what happened
   * while Changes lists them all: a long branch's first batch would push the conversation out of sight.
   */
  startsOpen: boolean;
}

/** An entry of the conversation: the timeline's, or a batch of check-ins. */
export type ConversationEntry = TimelineEntry | CheckinsEntry;

/**
 * A round that closed: the status that closed it, and where the threads started in it stand, those settled since the
 * reviewer's last status (shown under the "Since last review" line) too.
 */
export interface ReviewRound {
  number: number;
  reviewer: string;
  status: RoundStatus;
  date: string;
  /** What the reviewer said with the status that closed it. */
  comment: string;
  applied: number;
  discarded: number;
  answered: number;
  open: number;
  /** Folded to one line: nothing started in it is still open. */
  folds: boolean;
}

/** What the conversation shows, in order: closed rounds, the "Since last review" line, and the entries after them. */
export type ConversationBlock =
  | { kind: 'round'; round: ReviewRound; entries: ConversationEntry[] }
  | { kind: 'since'; date: string }
  | { kind: 'entry'; entry: ConversationEntry };

export interface ConversationInput {
  conversation: Pick<ReviewConversation, 'comments' | 'events'>;
  user: string | undefined;
  /** The branch's changesets, newest first; none for a review of a changeset or a shelve, or while they're read. */
  changesets: readonly Changeset[] | undefined;
  /** When the review was asked for: only changesets checked in since show in the timeline. */
  reviewDate: string;
}

/** A timeline item or a check-in, placed at the moment it shows. */
type Placed = { at: number; order: number; item: TimelineItem | CheckinsEntry };

/**
 * The conversation in blocks. Each round the user's statuses closed (everyone's, for the author) folds to a line once
 * nothing started in it is open; the latest entries stay as they are. For a reviewer, a "Since last review" line
 * follows their last status when anything came after it, and a thread from an earlier round settled since (applied,
 * answered, discarded) moves under it, when it settled: that's what they come back to check.
 */
export function conversationBlocksOf({ conversation, user, changesets, reviewDate }: ConversationInput): ConversationBlock[] {
  const { whose, statuses } = roundStatusesOf(conversation.events, user);
  const checkpoint = checkpointOf(conversation.events, user, changesets);
  const placed = placedItems(conversation, checkpoint, changesets, reviewDate);
  const threads = threadsOf(conversation.comments, changesetIdsOf(changesets));
  const blocks: ConversationBlock[] = [];
  let next = 0;
  statuses.forEach((closing, index) => {
    const end = Date.parse(closing.date);
    const inRound: Placed[] = [];
    while (next < placed.length && (placed[next]!.at < end || (placed[next]!.at === end && !closesAfter(placed[next]!, closing)))) inRound.push(placed[next++]!);
    const start = index === 0 ? -Infinity : Date.parse(statuses[index - 1]!.date);
    // Every thread started in the round counts, one settled since and shown under the line too: it's what the round asked.
    const startedIn = threads.filter((thread) => Date.parse(thread.root.date) > start && Date.parse(thread.root.date) <= end);
    blocks.push({ kind: 'round', round: roundOf(index + 1, closing, startedIn), entries: entriesOf(inRound, false) });
  });
  const rest = placed.slice(next);
  const since = whose === 'own' && rest.length > 0;
  if (since) blocks.push({ kind: 'since', date: checkpoint!.date });
  blocks.push(...entriesOf(rest, since).map((entry): ConversationBlock => ({ kind: 'entry', entry })));
  return blocks;
}

/** Whether an item at the very moment of a status comes after it: anything written after the status's own note. */
function closesAfter(placed: Placed, closing: ClosingStatus): boolean {
  const item = placed.item;
  return item.kind === 'event' && item.event.id > closing.eventId;
}

function placedItems(
  conversation: Pick<ReviewConversation, 'comments' | 'events'>,
  checkpoint: ReviewCheckpoint | undefined,
  changesets: readonly Changeset[] | undefined,
  reviewDate: string,
): Placed[] {
  const placed: Placed[] = timelineOf(conversation, changesetIdsOf(changesets)).map((item, order) => ({ at: placedAt(item, checkpoint, changesets), order, item }));
  const asked = Date.parse(reviewDate);
  const checkedIn = (changesets ?? []).filter((changeset) => Date.parse(changeset.date) > asked);
  // Check-ins come before what's said at the same moment: a fix, then the words about it.
  placed.push(...checkedIn.map((changeset): Placed => ({ at: Date.parse(changeset.date), order: -changeset.id, item: { kind: 'checkins', owner: changeset.owner, changesets: [changeset], startsOpen: true } })));
  placed.sort((a, b) => a.at - b.at || rank(a) - rank(b) || a.order - b.order);
  return batchedCheckins(placed);
}

function rank(placed: Placed): number {
  return placed.item.kind === 'checkins' ? 0 : 1;
}

/** A thread from before the checkpoint settled after it shows when it settled; everything else when it started. */
function placedAt(item: TimelineItem, checkpoint: ReviewCheckpoint | undefined, changesets: readonly Changeset[] | undefined): number {
  if (item.kind === 'event') return Date.parse(item.event.date);
  const started = Date.parse(item.thread.root.date);
  if (!checkpoint || started > Date.parse(checkpoint.date)) return started;
  const settled = settledDateOf(item.thread, changesets);
  return settled !== undefined && Date.parse(settled) > Date.parse(checkpoint.date) ? Date.parse(settled) : started;
}

/** Consecutive check-ins by one person, with nothing between them, as one entry. */
function batchedCheckins(placed: readonly Placed[]): Placed[] {
  const batched: Placed[] = [];
  for (const current of placed) {
    const previous = batched.at(-1);
    if (previous?.item.kind === 'checkins' && current.item.kind === 'checkins' && sameUser(previous.item.owner, current.item.owner)) {
      batched[batched.length - 1] = { ...previous, item: { ...previous.item, changesets: [...previous.item.changesets, ...current.item.changesets] } };
    } else batched.push(current);
  }
  return batched;
}

function roundOf(number: number, closing: ClosingStatus, threads: readonly ReviewThread[]): ReviewRound {
  const count = (kind: ReviewThread['state']['kind']): number => threads.filter((thread) => thread.state.kind === kind).length;
  const open = count('open');
  return { number, reviewer: closing.reviewer, status: closing.status, date: closing.date, comment: closing.comment, applied: count('applied'), discarded: count('discarded'), answered: count('answered'), open, folds: open === 0 };
}

/**
 * The timeline's own folding (reviewer changes in a row) within a run of entries, check-ins kept apart, listing their
 * changesets from the start only under the "Since last review" line (`underSince`).
 */
function entriesOf(placed: readonly Placed[], underSince: boolean): ConversationEntry[] {
  const entries: ConversationEntry[] = [];
  let run: TimelineItem[] = [];
  const endRun = (): void => {
    entries.push(...foldReviewerChanges(run));
    run = [];
  };
  for (const { item } of placed) {
    if (item.kind === 'checkins') {
      endRun();
      entries.push({ ...item, startsOpen: underSince });
    } else run.push(item);
  }
  endRun();
  return entries;
}

/** The threads "How it was applied" steps through together, and where they are: "Round 1", "New since last review". */
export interface StepGroup {
  threadIds: number[];
  /** Where in the conversation, said before the position ("Round 1 · 2 of 4"); empty before any round closed. */
  scope: string;
}

/**
 * The settled threads on lines (applied, answered, discarded) "How it was applied" steps through, part by part of the
 * conversation, each in the order it shows them: a closed round's; after every round, those under the "New since last
 * review" line for a reviewer, by when each settled, or those after the last round for anyone else. Stepping stays in
 * the part the reviewer is reading: a round closed long ago doesn't mix with what they came back to check.
 */
export function stepGroupsOf(blocks: readonly ConversationBlock[]): StepGroup[] {
  const settledIn = (entries: readonly ConversationEntry[]): number[] =>
    entries.flatMap((entry) => (entry.kind === 'thread' && isLineThread(entry.thread) && SETTLED.has(entry.thread.state.kind) ? [entry.thread.root.id] : []));
  const rounds = blocks.flatMap((block) => (block.kind === 'round' ? [block] : []));
  const groups = rounds.map((block) => ({ threadIds: settledIn(block.entries), scope: `Round ${block.round.number}` }));
  const last = rounds.at(-1);
  const since = blocks.some((block) => block.kind === 'since');
  const after = settledIn(blocks.flatMap((block) => (block.kind === 'entry' ? [block.entry] : [])));
  groups.push({ threadIds: after, scope: since ? 'New since last review' : last ? `After round ${last.round.number}` : '' });
  return groups.filter((group) => group.threadIds.length > 0);
}

const SETTLED = new Set<ReviewThread['state']['kind']>(['applied', 'answered', 'discarded']);

/** The round number holding a thread, to unfold it when the page goes there; none for one after every round. */
export function roundHolding(blocks: readonly ConversationBlock[], threadId: number): number | undefined {
  for (const block of blocks) {
    if (block.kind === 'round' && block.entries.some((entry) => entry.kind === 'thread' && entry.thread.root.id === threadId)) return block.round.number;
  }
  return undefined;
}
