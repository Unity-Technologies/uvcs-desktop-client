import '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { commentMenu } from './commentMenu';
import { threadsOf } from './reviewThreads';

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana', date: '', text: '', kind: 'general', anchor: { kind: 'review' }, ...fields };
}

const noop = { edit: () => {}, remove: () => {}, copyText: () => {} };
const ids = (entries: ReturnType<typeof commentMenu>) => entries.map((entry) => (typeof entry === 'object' && 'id' in entry ? entry.id : 'separator'));

describe('commentMenu', () => {
  it('offers its author to edit and delete a comment nobody answered, and anyone to copy it', () => {
    const [thread] = threadsOf([comment(1)]);

    expect(ids(commentMenu(thread!.root, thread!, 'ana', noop))).toEqual(['copyText', 'separator', 'editComment', 'separator', 'delete']);
    expect(ids(commentMenu(thread!.root, thread!, 'bob', noop))).toEqual(['copyText']);
  });

  it('keeps an answered comment from being deleted', () => {
    const [thread] = threadsOf([comment(1), comment(2, { parentId: 1, author: 'bob' })]);

    expect(ids(commentMenu(thread!.root, thread!, 'ana', noop))).toEqual(['copyText', 'separator', 'editComment']);
  });

  it("leads from a thread's first comment in the code to the conversation and to what changed since it", () => {
    const [thread] = threadsOf([comment(1), comment(2, { parentId: 1, author: 'bob' })]);
    const inCode = { ...noop, showInConversation: () => {}, changesSince: () => {} };

    expect(ids(commentMenu(thread!.root, thread!, 'bob', inCode))).toEqual(['showInConversation', 'changesSinceComment', 'separator', 'copyText']);
    expect(ids(commentMenu(thread!.replies[0]!, thread!, 'bob', inCode))).toEqual(['copyText', 'separator', 'editComment', 'separator', 'delete']);
  });
});
