import { describe, expect, it } from 'vitest';
import type { ReviewComment, ReviewEvent } from '@shared/domain/reviewConversation';
import { openThreads, threadsOf, timelineOf } from './reviewThreads';

const ON_LINE = { kind: 'line', revisionId: 29, itemId: 23, path: '/Assets/Scripts/SwitchFlow.cs', line: 11 } as const;

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana', date: `2026-11-06T10:${String(id).padStart(2, '0')}:00+01:00`, text: `Comment ${id}`, kind: 'general', anchor: { kind: 'review' }, ...fields };
}

const reply = (id: number, parentId: number, fields: Partial<ReviewComment> = {}) => comment(id, { parentId, kind: 'comment', ...fields });

describe('threadsOf', () => {
  it('gathers each comment with its replies, oldest first', () => {
    const threads = threadsOf([comment(1), comment(2), reply(3, 1), reply(4, 1)]);

    expect(threads.map(({ root, replies }) => [root.id, replies.map((answer) => answer.id)])).toEqual([
      [1, [3, 4]],
      [2, []],
    ]);
  });

  it('keeps a reply to a reply in its thread, at any depth, in the order they came', () => {
    const threads = threadsOf([comment(1), reply(2, 1), comment(3), reply(4, 2), reply(5, 4), reply(6, 1)]);

    expect(threads.map(({ root, replies }) => [root.id, replies.map((answer) => answer.id)])).toEqual([
      [1, [2, 4, 5, 6]],
      [3, []],
    ]);
  });

  it("starts a thread with a reply whose comment is gone, so it isn't lost", () => {
    expect(threadsOf([reply(5, 99)]).map((thread) => thread.root.id)).toEqual([5]);
  });

  it('keeps a change request open until a changeset applies it or a reply discards it', () => {
    const [open, applied, discarded] = threadsOf([
      comment(1, { kind: 'changeRequest', anchor: ON_LINE }),
      comment(2, { kind: 'changeRequest', anchor: ON_LINE, appliedInChangeset: 4 }),
      comment(3, { kind: 'changeRequest', anchor: ON_LINE }),
      reply(4, 1),
      reply(5, 3, { kind: 'discard' }),
    ]);

    expect([open?.state, applied?.state, discarded?.state]).toEqual([{ kind: 'open' }, { kind: 'applied', changesetId: 4 }, { kind: 'discarded' }]);
  });

  it('answers a question with any reply, as the server counts it', () => {
    const [unanswered, answered] = threadsOf([comment(1, { kind: 'question', anchor: ON_LINE }), comment(2, { kind: 'question', anchor: ON_LINE }), reply(3, 2)]);

    expect([unanswered?.state, answered?.state]).toEqual([{ kind: 'open' }, { kind: 'answered' }]);
  });

  it('never opens a plain or a general comment', () => {
    expect(threadsOf([comment(1), comment(2, { kind: 'comment', anchor: ON_LINE })]).map((thread) => thread.state)).toEqual([{ kind: 'none' }, { kind: 'none' }]);
  });
});

describe('openThreads', () => {
  it('keeps the change requests and questions still open', () => {
    const threads = threadsOf([comment(1, { kind: 'changeRequest' }), comment(2, { kind: 'question' }), comment(3, { kind: 'question' }), reply(4, 3), comment(5)]);

    expect(openThreads(threads).map((thread) => thread.root.id)).toEqual([1, 2]);
  });
});

describe('timelineOf', () => {
  const event = (id: number, date: string): ReviewEvent => ({ id, author: 'ana', date, kind: 'statusChanged', status: 'Reviewed', comment: '', guid: `e${id}` });

  it('puts the events and the threads in the order they happened, a thread at its first comment', () => {
    const timeline = timelineOf({
      comments: [comment(10), reply(30, 10)],
      events: [event(20, '2026-11-06T10:20:00+01:00'), event(5, '2026-11-06T10:05:00+01:00')],
    });

    expect(timeline.map((item) => (item.kind === 'event' ? `event ${item.event.id}` : `thread ${item.thread.root.id}`))).toEqual(['event 5', 'thread 10', 'event 20']);
  });

  it('orders what happened at the same moment as the server wrote it', () => {
    const at = '2026-11-06T10:00:00+01:00';
    const timeline = timelineOf({ comments: [comment(8, { date: at })], events: [event(9, at), event(7, at)] });

    expect(timeline.map((item) => (item.kind === 'event' ? item.event.id : item.thread.root.id))).toEqual([7, 8, 9]);
  });

  it('compares dates written with different offsets by the moment they name', () => {
    const timeline = timelineOf({ comments: [comment(1, { date: '2026-11-06T10:00:00+01:00' })], events: [event(2, '2026-11-06T09:30:00+00:00')] });

    expect(timeline.map((item) => item.kind)).toEqual(['thread', 'event']);
  });
});
