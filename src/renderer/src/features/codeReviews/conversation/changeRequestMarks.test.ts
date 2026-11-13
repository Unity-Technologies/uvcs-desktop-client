import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { changeRequestMarkOf, changesetsToApplyIn } from './changeRequestMarks';
import { threadsOf } from './reviewThreads';

const CM = '11.0.16.10616';

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana@acme.com', date: '', text: '', kind: 'changeRequest', anchor: { kind: 'review' }, ...fields };
}

describe('changeRequestMarkOf', () => {
  it('marks an open change request applied, for anyone signed in, its author too', () => {
    const [thread] = threadsOf([comment(1)]);

    expect(changeRequestMarkOf(thread!.root, thread!, 'bob@acme.com', CM)).toBe('applied');
    expect(changeRequestMarkOf(thread!.root, thread!, 'ana@acme.com', CM)).toBe('applied');
    expect(changeRequestMarkOf(thread!.root, thread!, undefined, CM)).toBeUndefined();
  });

  it('marks an applied change request as not applied, however it was applied', () => {
    const [thread] = threadsOf([comment(1, { appliedInChangeset: 4 })]);

    expect(changeRequestMarkOf(thread!.root, thread!, 'bob@acme.com', CM)).toBe('notApplied');
  });

  it('offers nothing on a discarded change request, a question or a comment', () => {
    const [discarded, question, general] = threadsOf([
      comment(1),
      comment(2, { parentId: 1, kind: 'discard', author: 'bob@acme.com' }),
      comment(3, { kind: 'question' }),
      comment(4, { kind: 'general' }),
    ]);

    expect([discarded, question, general].map((thread) => changeRequestMarkOf(thread!.root, thread!, 'bob@acme.com', CM))).toEqual([undefined, undefined, undefined]);
  });

  it("offers it on the change request itself, not on its replies", () => {
    const [thread] = threadsOf([comment(1), comment(2, { parentId: 1, kind: 'general', author: 'bob@acme.com' })]);

    expect(changeRequestMarkOf(thread!.replies[0]!, thread!, 'bob@acme.com', CM)).toBeUndefined();
  });

  it.each(['11.0.16.10615', '11.0.15.20000', undefined, 'unknown'])('offers nothing with cm %j, which has no apply or unapply', (version) => {
    const [open, applied] = threadsOf([comment(1), comment(2, { appliedInChangeset: 4 })]);

    expect(changeRequestMarkOf(open!.root, open!, 'bob@acme.com', version)).toBeUndefined();
    expect(changeRequestMarkOf(applied!.root, applied!, 'bob@acme.com', version)).toBeUndefined();
  });

  it('offers it with a later cm', () => {
    const [thread] = threadsOf([comment(1)]);

    expect(changeRequestMarkOf(thread!.root, thread!, 'bob@acme.com', '11.0.17.1')).toBe('applied');
  });
});

describe('changesetsToApplyIn', () => {
  it("offers a branch's review the branch's changesets, the read its Changes tab lists them by", () => {
    expect(changesetsToApplyIn({ kind: 'branch', branch: '/main/task' })).toEqual({ branch: '/main/task', limit: expect.any(Number) });
  });

  it("offers any other review the repository's newest changesets", () => {
    expect(changesetsToApplyIn({ kind: 'changeset', changesetId: 8 })).toBeUndefined();
    expect(changesetsToApplyIn({ kind: 'shelve', shelveId: 3 })).toBeUndefined();
    expect(changesetsToApplyIn({ kind: 'unknown', description: 'gone' })).toBeUndefined();
  });
});
