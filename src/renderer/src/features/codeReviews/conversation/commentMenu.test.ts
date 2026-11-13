import '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { commentMenu } from './commentMenu';
import { threadsOf } from './reviewThreads';

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana', date: '', text: '', kind: 'general', anchor: { kind: 'review' }, ...fields };
}

const noop = { edit: () => {}, remove: () => {}, copyTexts: { comment: 'Nice', link: 'uvcs://local/repos/game/code-reviews/41/-/comments/1' } };
const ids = (entries: ReturnType<typeof commentMenu>) => entries.map((entry) => (typeof entry === 'object' && 'id' in entry ? entry.id : 'separator'));

describe('commentMenu', () => {
  it('offers its author to edit and delete a comment nobody answered, and anyone to copy it or its link', () => {
    const [thread] = threadsOf([comment(1)]);

    expect(ids(commentMenu(thread!.root, thread!, 'ana', noop))).toEqual(['copy', 'separator', 'editComment', 'separator', 'delete']);
    expect(ids(commentMenu(thread!.root, thread!, 'bob', noop))).toEqual(['copy']);
  });

  it('keeps an answered comment from being deleted', () => {
    const [thread] = threadsOf([comment(1), comment(2, { parentId: 1, author: 'bob' })]);

    expect(ids(commentMenu(thread!.root, thread!, 'ana', noop))).toEqual(['copy', 'separator', 'editComment']);
  });

  it("leads from a thread's first comment in the code to the conversation", () => {
    const [thread] = threadsOf([comment(1), comment(2, { parentId: 1, author: 'bob' })]);
    const inCode = { ...noop, showInConversation: () => {} };

    expect(ids(commentMenu(thread!.root, thread!, 'bob', inCode))).toEqual(['showInConversation', 'separator', 'copy']);
    expect(ids(commentMenu(thread!.replies[0]!, thread!, 'bob', inCode))).toEqual(['copy', 'separator', 'editComment', 'separator', 'delete']);
  });
});
