import { describe, expect, it } from 'vitest';
import type { Changeset } from '@shared/domain/changeset';
import type { CodeReviewStatus } from '@shared/domain/codeReview';
import type { ReviewComment, ReviewConversation, ReviewEvent } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import { checkpointOf, conversationBlocksOf, reviewedUpToOf, newThreadIds, roundHolding, roundStatusesOf, stepGroupsOf, type ConversationBlock, type ConversationEntry } from './reviewRounds';

// Dates as `cm find` prints them with `--dateformat=o`: a round trip, its offset the server's.
const at = (day: number, hour: number, offset = '+01:00'): string => `2026-11-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00${offset}`;

const ON_LINE = { kind: 'line', revisionId: 29, itemId: 23, path: '/Assets/Waves/WaveSpawner.cs', line: 43 } as const;

function comment(id: number, date: string, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'vio', date, text: `Comment ${id}`, kind: 'general', anchor: { kind: 'review' }, ...fields };
}
const request = (id: number, date: string, fields: Partial<ReviewComment> = {}) => comment(id, date, { kind: 'changeRequest', anchor: ON_LINE, ...fields });
const question = (id: number, date: string, fields: Partial<ReviewComment> = {}) => comment(id, date, { kind: 'question', anchor: ON_LINE, ...fields });
const reply = (id: number, parentId: number, date: string, fields: Partial<ReviewComment> = {}) => comment(id, date, { parentId, kind: 'comment', author: 'dani', ...fields });

function status(id: number, author: string, value: CodeReviewStatus, date: string): ReviewEvent {
  return { id, author, date, kind: 'statusChanged', status: value, comment: '', guid: `s${id}` };
}
const askedAgain = (id: number, date: string): ReviewEvent => ({ id, author: 'dani', date, kind: 'reviewRequestedAgain', reviewer: 'vio' });

/** A branch's changesets as the page reads them: newest first. */
function changesets(...made: [id: number, date: string, owner?: string][]): Changeset[] {
  return made
    .map(([id, date, owner = 'dani']) => ({ id, guid: `c${id}`, branch: '/main/waves', comment: `Changeset ${id}\nmore`, owner, date, parent: id - 1, repository: 'game@local' }))
    .reverse();
}

function conversation(comments: ReviewComment[], events: ReviewEvent[]): ReviewConversation {
  return { comments, events };
}

/** What a list of blocks shows, in words a test reads at a glance. */
function shapeOf(blocks: readonly ConversationBlock[]): string[] {
  return blocks.map((block) => {
    switch (block.kind) {
      case 'round':
        return `round ${block.round.number}${block.round.folds ? ' (folded)' : ''}: ${block.entries.map(entryName).join(', ')}`;
      case 'since':
        return 'since';
      case 'entry':
        return entryName(block.entry);
    }
  });
}

function entryName(entry: ConversationEntry): string {
  switch (entry.kind) {
    case 'event':
      return `event ${entry.event.id}`;
    case 'reviewerChanges':
      return `events ${entry.events.map((event) => event.id).join('+')}`;
    case 'thread':
      return `thread ${entry.thread.root.id}`;
    case 'checkins':
      return `checkins ${entry.changesets.map((changeset) => changeset.id).join('+')}`;
  }
}

describe('roundStatusesOf', () => {
  it("takes a reviewer's own statuses that close a round, oldest first, leaving Under review out", () => {
    const events = [status(9, 'vio', 'Rework required', at(9, 16)), status(3, 'VIO', 'Rework required', at(7, 10)), status(5, 'vio', 'Under review', at(8, 9)), status(6, 'ana', 'Reviewed', at(8, 11))];

    expect(roundStatusesOf(events, 'vio')).toEqual({
      whose: 'own',
      statuses: [
        { eventId: 3, reviewer: 'VIO', status: 'Rework required', date: at(7, 10), comment: '' },
        { eventId: 9, reviewer: 'vio', status: 'Rework required', date: at(9, 16), comment: '' },
      ],
    });
  });

  it("takes every reviewer's statuses for someone who gave none: the author, a bystander", () => {
    const events = [status(3, 'vio', 'Rework required', at(7, 10)), status(6, 'ana', 'Reviewed', at(8, 11))];

    expect(roundStatusesOf(events, 'dani')).toEqual({ whose: 'everyone', statuses: [expect.objectContaining({ eventId: 3 }), expect.objectContaining({ eventId: 6 })] });
    expect(roundStatusesOf(events, undefined).whose).toBe('everyone');
  });

  it('has no rounds before any status that closes one: a first review', () => {
    expect(roundStatusesOf([status(1, 'vio', 'Under review', at(7, 10))], 'vio')).toEqual({ whose: 'everyone', statuses: [] });
  });
});

describe('checkpointOf', () => {
  it("is the reviewer's newest status, and the newest changeset on the branch then", () => {
    const events = [status(3, 'vio', 'Rework required', at(7, 10)), status(9, 'vio', 'Reviewed', at(9, 16))];
    const branch = changesets([12, at(7, 9)], [14, at(9, 15)], [15, at(10, 9)]);

    expect(checkpointOf(events, 'vio', branch)).toEqual({ date: at(9, 16), status: 'Reviewed', changesetId: 14 });
  });

  it('compares dates across time zones, as the server and the reviewer may be in different ones', () => {
    // 16:00 in Madrid is 15:00 UTC: a changeset at 15:30 UTC came after the status.
    const events = [status(9, 'vio', 'Reviewed', at(9, 16, '+01:00'))];
    const branch = changesets([14, at(9, 14, 'Z')], [15, '2026-11-09T15:30:00Z']);

    expect(checkpointOf(events, 'vio', branch)?.changesetId).toBe(14);
  });

  it('names no changeset when the status came before any on the branch, or for a review of no branch', () => {
    const events = [status(9, 'vio', 'Rework required', at(7, 8))];

    expect(checkpointOf(events, 'vio', changesets([12, at(7, 9)]))).toEqual({ date: at(7, 8), status: 'Rework required' });
    expect(checkpointOf(events, 'vio', undefined)).toEqual({ date: at(7, 8), status: 'Rework required' });
  });

  it('is none for a user who gave no status yet, or only Under review (asked again)', () => {
    expect(checkpointOf([status(3, 'ana', 'Reviewed', at(7, 10))], 'vio', [])).toBeUndefined();
    expect(checkpointOf([status(3, 'vio', 'Under review', at(7, 10))], 'vio', [])).toBeUndefined();
  });

  it("is each reviewer's own: two reviewers, two checkpoints", () => {
    const events = [status(3, 'vio', 'Rework required', at(7, 10)), status(6, 'ana', 'Reviewed', at(8, 11))];

    expect(checkpointOf(events, 'vio', [])?.date).toBe(at(7, 10));
    expect(checkpointOf(events, 'ana', [])?.date).toBe(at(8, 11));
  });

  it("is a reviewer group member's own, as the server notes the status under their name", () => {
    // A member of a group setting a status is added as a user: the event names the user, never the group.
    expect(checkpointOf([status(3, 'borja', 'Reviewed', at(7, 10))], 'borja', [])?.date).toBe(at(7, 10));
  });
});

describe('reviewedUpToOf', () => {
  const branch = changesets([12, at(7, 9)], [14, at(9, 15)], [15, at(10, 9)]);

  it("is the user's own checkpoint once they gave a status", () => {
    const events = [status(3, 'vio', 'Rework required', at(7, 10)), status(9, 'ana', 'Reviewed', at(9, 16))];

    expect(reviewedUpToOf(events, 'vio', branch)).toEqual({ date: at(7, 10), changesetId: 12 });
  });

  it("is the newest reviewer's for anyone who gave none, the author too, naming them", () => {
    const events = [status(3, 'vio', 'Rework required', at(7, 10)), status(9, 'ana', 'Reviewed', at(9, 16))];

    expect(reviewedUpToOf(events, 'dani', branch)).toEqual({ date: at(9, 16), changesetId: 14, by: 'ana' });
  });

  it('is none before anyone reviewed', () => {
    expect(reviewedUpToOf([status(1, 'vio', 'Under review', at(7, 10))], 'dani', branch)).toBeUndefined();
  });
});

describe('newThreadIds', () => {
  const checkpoint = { date: at(9, 16), status: 'Rework required', changesetId: 14 } as const;
  const branch = changesets([14, at(9, 15)], [15, at(10, 9)]);

  it('marks a thread new when someone else said something on it after the checkpoint', () => {
    const threads = threadsOf([
      request(1, at(8, 10)),
      reply(2, 1, at(10, 10)), // answered by the author since
      comment(3, at(10, 11), { author: 'dani' }), // a new comment by the author
      comment(4, at(10, 12), { author: 'vio' }), // the reviewer's own, after: not news to her
      question(5, at(8, 11)),
      reply(6, 5, at(9, 10)), // answered before the checkpoint
    ]);

    expect([...newThreadIds(threads, checkpoint, 'vio', branch)].sort()).toEqual([1, 3]);
  });

  it('marks a change request applied in a changeset after the checkpoint new and settled since', () => {
    const threads = threadsOf([request(1, at(8, 10), { appliedInChangeset: 15 }), request(2, at(8, 11), { appliedInChangeset: 14 })]);

    expect([...newThreadIds(threads, checkpoint, 'vio', branch)]).toEqual([1]);
  });

  it('tells an applying changeset the branch list misses by its number against the checkpoint', () => {
    // Changeset numbers grow with time in a repository: one past the checkpoint's came after it.
    const threads = threadsOf([request(1, at(8, 10), { appliedInChangeset: 20 }), request(2, at(8, 11), { appliedInChangeset: 3 })]);

    expect([...newThreadIds(threads, checkpoint, 'vio', branch)]).toEqual([1]);
  });
});

describe('stepGroupsOf', () => {
  it('steps through the threads settled in each round, and those settled since the last review in the order the line shows them', () => {
    const blocks = conversationBlocksOf({
      conversation: conversation(
        [
          request(1, at(7, 8), { appliedInChangeset: 12 }),
          question(2, at(7, 8)),
          reply(3, 2, at(7, 9)),
          request(5, at(9, 10)),
          reply(6, 5, at(10, 11), { kind: 'discard' }),
          request(7, at(9, 11), { appliedInChangeset: 15 }),
          question(8, at(9, 12)), // still open: nothing to step to
        ],
        [status(4, 'vio', 'Rework required', at(7, 10)), status(9, 'vio', 'Rework required', at(9, 16))],
      ),
      user: 'vio',
      changesets: changesets([12, at(7, 9)], [15, at(10, 9)]),
      reviewDate: at(7, 7),
    });

    // cs:15 at 9:00 applied 7, then 5 was discarded at 11:00.
    expect(stepGroupsOf(blocks)).toEqual([
      { threadIds: [1, 2], scope: 'Round 1' },
      { threadIds: [7, 5], scope: 'New since your last review' },
    ]);
  });

  it("names the span after every round by the round it follows for someone with no line, and none before any round", () => {
    const after = conversationBlocksOf({
      conversation: conversation([request(1, at(7, 8)), reply(2, 1, at(7, 9), { kind: 'discard' }), request(4, at(8, 8)), reply(5, 4, at(8, 9), { kind: 'discard' })], [status(3, 'vio', 'Reviewed', at(7, 10))]),
      user: 'dani',
      changesets: undefined,
      reviewDate: at(7, 7),
    });
    const none = conversationBlocksOf({ conversation: conversation([request(1, at(7, 8)), reply(2, 1, at(7, 9), { kind: 'discard' })], []), user: 'dani', changesets: undefined, reviewDate: at(7, 7) });

    expect(stepGroupsOf(after)).toEqual([
      { threadIds: [1], scope: 'Round 1' },
      { threadIds: [4], scope: 'After round 1' },
    ]);
    expect(stepGroupsOf(none)).toEqual([{ threadIds: [1], scope: '' }]);
  });
});

describe('conversationBlocksOf', () => {
  it('folds nothing and draws no line on a first review', () => {
    const blocks = conversationBlocksOf({ conversation: conversation([request(1, at(8, 10))], []), user: 'vio', changesets: undefined, reviewDate: at(7, 9) });

    expect(shapeOf(blocks)).toEqual(['thread 1']);
  });

  it("folds the reviewer's settled rounds and draws the line after her last status", () => {
    const blocks = conversationBlocksOf({
      conversation: conversation(
        [request(1, at(7, 9), { appliedInChangeset: 12 }), request(4, at(9, 15), { appliedInChangeset: 15 }), comment(7, at(10, 12), { author: 'dani' })],
        [status(2, 'vio', 'Rework required', at(7, 10)), askedAgain(3, at(8, 9)), status(5, 'vio', 'Rework required', at(9, 16))],
      ),
      user: 'vio',
      changesets: changesets([12, at(8, 8)], [15, at(10, 9)]),
      reviewDate: at(7, 8),
    });

    // Request 4 was applied since her last status: it's news, so it shows after the line, when it was applied.
    expect(shapeOf(blocks)).toEqual(['round 1 (folded): thread 1, event 2', 'round 2 (folded): checkins 12, event 3, event 5', 'since', 'checkins 15', 'thread 4', 'thread 7']);
  });

  it('lists the changesets of check-ins under the New since your last review line, and folds the others to their line', () => {
    const blocks = conversationBlocksOf({
      conversation: conversation([], [status(2, 'vio', 'Rework required', at(9, 16))]),
      user: 'vio',
      changesets: changesets([12, at(8, 8)], [15, at(10, 9)]),
      reviewDate: at(7, 8),
    });
    const startsOpen = (entry: ConversationEntry | undefined): boolean | undefined => (entry?.kind === 'checkins' ? entry.startsOpen : undefined);

    expect(blocks[0]?.kind === 'round' && startsOpen(blocks[0].entries[0])).toBe(false);
    expect(blocks[2]?.kind === 'entry' && startsOpen(blocks[2].entry)).toBe(true);
    // The author's view, and a first review, have no line: their check-ins fold too.
    const [first] = conversationBlocksOf({ conversation: conversation([], []), user: 'vio', changesets: changesets([12, at(8, 8)]), reviewDate: at(7, 8) });
    expect(first?.kind === 'entry' && startsOpen(first.entry)).toBe(false);
  });

  it('moves a request discarded and a question answered since the last review under the line, when they settled', () => {
    const blocks = conversationBlocksOf({
      conversation: conversation(
        [request(1, at(7, 9)), reply(4, 1, at(10, 11), { kind: 'discard' }), question(2, at(7, 9)), reply(5, 2, at(10, 10)), question(3, at(7, 9))],
        [status(6, 'vio', 'Rework required', at(9, 16))],
      ),
      user: 'vio',
      changesets: undefined,
      reviewDate: at(7, 8),
    });

    // Question 3 is still open: its round shows unfolded, holding it where it was asked.
    expect(shapeOf(blocks)).toEqual(['round 1: thread 3, event 6', 'since', 'thread 2', 'thread 1']);
  });

  it('keeps in the round what was said at the very second of its status before it, and puts after it what came after', () => {
    const blocks = conversationBlocksOf({
      conversation: conversation([comment(1, at(9, 16))], [status(5, 'vio', 'Rework required', at(9, 16)), askedAgain(7, at(9, 16))]),
      user: 'vio',
      changesets: undefined,
      reviewDate: at(7, 8),
    });

    // The comment is the status's moment and before it in the round; event 7, written after the status's own note, is news.
    expect(shapeOf(blocks)).toEqual(['round 1 (folded): thread 1, event 5', 'since', 'event 7']);
  });

  it('counts in its round a thread settled since, though it shows under the line', () => {
    const blocks = conversationBlocksOf({
      conversation: conversation([request(1, at(9, 15), { appliedInChangeset: 15 })], [status(2, 'vio', 'Rework required', at(9, 16))]),
      user: 'vio',
      changesets: changesets([15, at(10, 9)]),
      reviewDate: at(7, 8),
    });

    expect(shapeOf(blocks)).toEqual(['round 1 (folded): event 2', 'since', 'checkins 15', 'thread 1']);
    expect(blocks[0]?.kind === 'round' && blocks[0].round.applied).toBe(1);
  });

  it('keeps a round with something still open unfolded', () => {
    const blocks = conversationBlocksOf({
      conversation: conversation([request(1, at(7, 9))], [status(2, 'vio', 'Rework required', at(7, 10))]),
      user: 'vio',
      changesets: undefined,
      reviewDate: at(7, 8),
    });

    expect(shapeOf(blocks)).toEqual(['round 1: thread 1, event 2']);
  });

  it('draws no line when nothing came after the last status', () => {
    const blocks = conversationBlocksOf({
      conversation: conversation([comment(1, at(7, 9))], [status(2, 'vio', 'Reviewed', at(7, 10))]),
      user: 'vio',
      changesets: undefined,
      reviewDate: at(7, 8),
    });

    expect(shapeOf(blocks)).toEqual(['round 1 (folded): thread 1, event 2']);
  });

  it("folds rounds by every reviewer's statuses for the author, with no line", () => {
    const blocks = conversationBlocksOf({
      conversation: conversation(
        [request(1, at(7, 9), { appliedInChangeset: 12 }), request(4, at(9, 15))],
        [status(2, 'vio', 'Rework required', at(7, 10)), status(5, 'ana', 'Rework required', at(9, 16))],
      ),
      user: 'dani',
      changesets: changesets([12, at(8, 8)]),
      reviewDate: at(7, 8),
    });

    expect(shapeOf(blocks)).toEqual(['round 1 (folded): thread 1, event 2', 'round 2: checkins 12, thread 4, event 5']);
  });

  it('shows only the changesets checked in once the review was asked for, batched by who checked them in between what was said', () => {
    const blocks = conversationBlocksOf({
      conversation: conversation([comment(1, at(8, 12))], []),
      user: 'vio',
      changesets: changesets([10, at(6, 9)], [11, at(8, 9)], [12, at(8, 10)], [13, at(8, 11), 'ana'], [14, at(8, 13)]),
      reviewDate: at(7, 8),
    });

    expect(shapeOf(blocks)).toEqual(['checkins 11+12', 'checkins 13', 'thread 1', 'checkins 14']);
  });

  it('counts what each round settled, in words for its folded line', () => {
    const [round] = conversationBlocksOf({
      conversation: conversation(
        [request(1, at(7, 9), { appliedInChangeset: 12 }), request(3, at(7, 9)), reply(4, 3, at(7, 9), { kind: 'discard' }), question(5, at(7, 9)), reply(6, 5, at(7, 9))],
        [status(2, 'vio', 'Rework required', at(7, 10))],
      ),
      user: 'vio',
      changesets: changesets([12, at(7, 9)]),
      reviewDate: at(7, 8),
    });

    expect(round?.kind === 'round' && round.round).toEqual(
      expect.objectContaining({ number: 1, reviewer: 'vio', status: 'Rework required', date: at(7, 10), applied: 1, discarded: 1, answered: 1, open: 0 }),
    );
  });

  it('finds the round holding a thread, so going to it unfolds that round', () => {
    const blocks = conversationBlocksOf({
      conversation: conversation([comment(1, at(7, 9)), comment(3, at(7, 11))], [status(2, 'vio', 'Reviewed', at(7, 10))]),
      user: 'vio',
      changesets: undefined,
      reviewDate: at(7, 8),
    });

    expect(roundHolding(blocks, 1)).toBe(1);
    expect(roundHolding(blocks, 3)).toBeUndefined();
  });
});
