import type { ReviewComment, ReviewConversation, ReviewEvent, ReviewEventChange } from '@shared/domain/reviewConversation';
import { isShownEvent } from './reviewEventText';

/** An event the timeline shows: one this version reads. */
export type ShownEvent = ReviewEvent & Exclude<ReviewEventChange, { kind: 'other' }>;

/**
 * Where a thread stands, as the server counts it (its open items, `{unresolvedissues}`): a change request is open
 * until a changeset applies it or a reply discards it; a question until anyone replies. Other comments are never open.
 */
export type ThreadState = { kind: 'none' } | { kind: 'open' } | { kind: 'answered' } | { kind: 'applied'; changesetId: number } | { kind: 'discarded' };

/** A comment and its replies, oldest first. */
export interface ReviewThread {
  root: ReviewComment;
  replies: ReviewComment[];
  state: ThreadState;
}

/** What the conversation shows, in the order it happened: the server's notes and the threads, by when each started. */
export type TimelineItem = { kind: 'event'; event: ShownEvent } | { kind: 'thread'; thread: ReviewThread };

/**
 * The comments as threads, in the order they came: each thread a comment and every reply under it, at any depth
 * (other clients answer replies too), oldest first. A reply whose comment is gone (another client deleted it, keeping
 * its replies) starts a thread of its own, so nothing said is lost.
 */
export function threadsOf(comments: readonly ReviewComment[]): ReviewThread[] {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const rootOf = (comment: ReviewComment): ReviewComment => {
    let current = comment;
    const seen = new Set<number>();
    while (current.parentId !== undefined && byId.has(current.parentId) && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(current.parentId)!;
    }
    return current;
  };
  const replies = new Map<number, ReviewComment[]>();
  const roots: ReviewComment[] = [];
  for (const comment of comments) {
    const root = rootOf(comment);
    if (root === comment) roots.push(comment);
    else replies.set(root.id, [...(replies.get(root.id) ?? []), comment]);
  }
  return roots.map((root) => {
    const answers = replies.get(root.id) ?? [];
    return { root, replies: answers, state: threadState(root, answers) };
  });
}

/** Whether anyone replied to `comment` itself, in its thread. */
export function hasReplies(comment: ReviewComment, thread: ReviewThread): boolean {
  return thread.replies.some((reply) => reply.parentId === comment.id);
}

function threadState(root: ReviewComment, replies: readonly ReviewComment[]): ThreadState {
  if (root.kind === 'changeRequest') {
    if (root.appliedInChangeset !== undefined) return { kind: 'applied', changesetId: root.appliedInChangeset };
    return replies.some((reply) => reply.kind === 'discard') ? { kind: 'discarded' } : { kind: 'open' };
  }
  if (root.kind === 'question') return replies.length > 0 ? { kind: 'answered' } : { kind: 'open' };
  return { kind: 'none' };
}

/**
 * The events and threads by date, oldest first; at the same moment, in the order the server wrote them. An event this
 * version doesn't read (`isShownEvent`) is left out rather than shown as the server wrote it.
 */
export function timelineOf(conversation: Pick<ReviewConversation, 'comments' | 'events'>): TimelineItem[] {
  const items: TimelineItem[] = [
    ...conversation.events.filter(isShownEvent).map((event): TimelineItem => ({ kind: 'event', event })),
    ...threadsOf(conversation.comments).map((thread): TimelineItem => ({ kind: 'thread', thread })),
  ];
  return items.sort((a, b) => Date.parse(startOf(a).date) - Date.parse(startOf(b).date) || startOf(a).id - startOf(b).id);
}

function startOf(item: TimelineItem): { date: string; id: number } {
  return item.kind === 'event' ? item.event : item.thread.root;
}

/** The threads still open: change requests to apply or discard, questions to answer. */
export function openThreads(threads: readonly ReviewThread[]): ReviewThread[] {
  return threads.filter((thread) => thread.state.kind === 'open');
}
