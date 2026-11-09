import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { canDeleteComment, canDiscard, canEditComment } from './commentPermissions';
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

describe('canDeleteComment', () => {
  it("lets the author delete a thread's first comment only while nobody replied", () => {
    const [alone, answered] = threadsOf([comment(1), comment(2), comment(3, { parentId: 2, author: 'bob@acme.com' })]);

    expect(canDeleteComment(alone!.root, alone!, 'ana@acme.com')).toBe(true);
    expect(canDeleteComment(answered!.root, answered!, 'ana@acme.com')).toBe(false);
  });

  it('keeps a reply that someone answered from being deleted, wherever it is in the thread', () => {
    const [thread] = threadsOf([comment(1), comment(2, { parentId: 1 }), comment(3, { parentId: 2, author: 'bob@acme.com' })]);
    const [answered, answer] = thread!.replies;

    expect(canDeleteComment(answered!, thread!, 'ana@acme.com')).toBe(false);
    expect(canDeleteComment(answer!, thread!, 'bob@acme.com')).toBe(true);
  });

  it('lets the author delete a reply, and nobody else', () => {
    const [thread] = threadsOf([comment(1), comment(2, { parentId: 1, author: 'bob@acme.com' })]);
    const [answer] = thread!.replies;

    expect(canDeleteComment(answer!, thread!, 'bob@acme.com')).toBe(true);
    expect(canDeleteComment(answer!, thread!, 'ana@acme.com')).toBe(false);
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
