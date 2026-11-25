import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { commentsDeletedWith, deleteConfirmation } from './commentDeletion';
import { threadsOf } from './reviewThreads';

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana@acme.com', date: `2026-11-0${id}`, text: '', kind: 'general', anchor: { kind: 'review' }, ...fields };
}

const guids = (comments: readonly ReviewComment[]) => comments.map((each) => each.guid);

describe('commentsDeletedWith', () => {
  it('deletes a comment nobody answered alone', () => {
    const [thread] = threadsOf([comment(1)]);

    expect(guids(commentsDeletedWith(thread!.root, thread!))).toEqual(['g1']);
  });

  it("deletes a thread's first comment with every reply, whoever wrote it, each before what it answers", () => {
    const [thread] = threadsOf([comment(1), comment(2, { parentId: 1, author: 'bob@acme.com' }), comment(3, { parentId: 2 }), comment(4, { parentId: 1 })]);

    expect(guids(commentsDeletedWith(thread!.root, thread!))).toEqual(['g3', 'g2', 'g4', 'g1']);
  });

  it('deletes a reply with the replies under it, and leaves the rest of the thread', () => {
    const [thread] = threadsOf([comment(1), comment(2, { parentId: 1 }), comment(3, { parentId: 2 }), comment(4, { parentId: 1 })]);
    const answered = thread!.replies.find((reply) => reply.id === 2)!;

    expect(guids(commentsDeletedWith(answered, thread!))).toEqual(['g3', 'g2']);
  });

  it("deletes a thread whose first comment answers one another client deleted, the replies under it only", () => {
    const [thread] = threadsOf([comment(2, { parentId: 1 }), comment(3, { parentId: 2 })]);

    expect(guids(commentsDeletedWith(thread!.root, thread!))).toEqual(['g3', 'g2']);
  });
});

describe('deleteConfirmation', () => {
  it('asks about the comment alone when nobody answered it', () => {
    expect(deleteConfirmation(1)).toEqual({ title: 'Delete this comment?', message: 'Everyone on the review stops seeing it.' });
  });

  it('says how many replies go with it', () => {
    expect(deleteConfirmation(2)).toEqual({ title: 'Delete this comment and its reply?', message: 'Everyone on the review stops seeing them.' });
    expect(deleteConfirmation(4)).toEqual({ title: 'Delete this comment and its 3 replies?', message: 'Everyone on the review stops seeing them.' });
  });
});
