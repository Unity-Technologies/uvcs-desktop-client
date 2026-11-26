import { describe, expect, it } from 'vitest';
import type { ReviewComment, ReviewEvent } from '@shared/domain/reviewConversation';
import { canDeleteComment, canDiscard, canEditComment, canEditStatusComment } from './commentPermissions';
import { threadsOf } from './reviewThreads';

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana@acme.com', date: '', text: '', kind: 'general', anchor: { kind: 'review' }, ...fields };
}

describe('canEditComment', () => {
  it('lets only the author edit, whatever the case their name is written in', () => {
    expect(canEditComment(comment(1), 'Ana@Acme.com')).toBe(true);
    expect(canEditComment(comment(1), 'bob@acme.com')).toBe(false);
    expect(canEditComment(comment(1), undefined)).toBe(false);
  });
});

describe('canEditStatusComment', () => {
  const status: ReviewEvent = { id: 7, author: 'ana@acme.com', date: '', kind: 'statusChanged', status: 'Reviewed', comment: 'LGTM', guid: 's7' };

  it('lets only the reviewer who gave the status edit what they said with it, even when they said nothing', () => {
    expect(canEditStatusComment(status, 'Ana@Acme.com')).toBe(true);
    expect(canEditStatusComment({ ...status, comment: '' }, 'ana@acme.com')).toBe(true);
    expect(canEditStatusComment(status, 'bob@acme.com')).toBe(false);
    expect(canEditStatusComment(status, undefined)).toBe(false);
  });

  it("leaves the server's other notes as they were written", () => {
    expect(canEditStatusComment({ id: 8, author: 'ana@acme.com', date: '', kind: 'titleChanged', from: 'a', to: 'b' }, 'ana@acme.com')).toBe(false);
  });
});

describe('canDeleteComment', () => {
  it('lets only the author delete a comment, answered or not: its replies go with it (`commentsDeletedWith`)', () => {
    const [thread] = threadsOf([comment(1), comment(2, { parentId: 1, author: 'bob@acme.com' })]);
    const [answer] = thread!.replies;

    expect(canDeleteComment(thread!.root, 'Ana@Acme.com')).toBe(true);
    expect(canDeleteComment(thread!.root, 'bob@acme.com')).toBe(false);
    expect(canDeleteComment(answer!, 'bob@acme.com')).toBe(true);
    expect(canDeleteComment(answer!, 'ana@acme.com')).toBe(false);
    expect(canDeleteComment(answer!, undefined)).toBe(false);
  });
});

describe('canDiscard', () => {
  const changeRequest = (fields: Partial<ReviewComment> = {}) => comment(1, { kind: 'changeRequest', ...fields });

  it('lets anyone but who asked for it discard an open change request', () => {
    const [thread] = threadsOf([changeRequest()]);

    expect(canDiscard(thread!, 'bob@acme.com')).toBe(true);
    expect(canDiscard(thread!, 'ana@acme.com')).toBe(false);
    expect(canDiscard(thread!, undefined)).toBe(false);
  });

  it('offers nothing to discard once applied or discarded, nor on a question', () => {
    const [applied] = threadsOf([changeRequest({ appliedInChangeset: 4 })]);
    const [discarded] = threadsOf([changeRequest(), comment(2, { parentId: 1, kind: 'discard' })]);
    const [question] = threadsOf([comment(3, { kind: 'question' })]);

    expect([applied, discarded, question].map((thread) => canDiscard(thread!, 'bob@acme.com'))).toEqual([false, false, false]);
  });
});
