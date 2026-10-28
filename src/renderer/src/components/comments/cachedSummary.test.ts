import { describe, expect, it } from 'vitest';
import type { CommentReference } from '../../lib/comments/commentReferences';
import { cachedAreaOf, summaryIn } from './cachedSummary';

describe('summaryIn', () => {
  const changesets = [
    { id: 12, comment: 'Fix the switch\n\nLong description' },
    { id: 13, comment: '' },
  ];

  it("takes an object's summary from a list read before", () => {
    expect(summaryIn([changesets], { kind: 'changeset', id: 12 })).toBe('Fix the switch');
    expect(summaryIn([[{ id: 7, title: 'Review the switch' }]], { kind: 'codeReview', id: 7 })).toBe('Review the switch');
    expect(summaryIn([[{ name: '/main/task', comment: 'Task' }]], { kind: 'branch', name: '/main/task' })).toBe('Task');
  });

  it('reads the summary without Markdown marks, emoji as themselves', () => {
    expect(summaryIn([[{ id: 2, comment: '**Switching** keeps changes :tada:' }]], { kind: 'changeset', id: 2 })).toBe('Switching keeps changes 🎉');
  });

  it("reads the place's lists only: an object read alone may be another repository's (an xlink's changeset)", () => {
    expect(summaryIn([{ id: 12, comment: "The xlinked repository's changeset" }], { kind: 'changeset', id: 12 })).toBeUndefined();
  });

  it('has none for an object nothing read, or one without a comment', () => {
    expect(summaryIn([changesets], { kind: 'changeset', id: 99 })).toBeUndefined();
    expect(summaryIn([changesets], { kind: 'changeset', id: 13 })).toBeUndefined();
    expect(summaryIn([undefined, null, 'text'], { kind: 'label', name: 'v1' })).toBeUndefined();
  });
});

describe('cachedAreaOf', () => {
  it("looks only the place's own objects up", () => {
    expect(cachedAreaOf({ kind: 'changeset', id: 1 })).toBe('changesets');
    expect(cachedAreaOf({ kind: 'codeReview', id: 1 })).toBe('codeReviews');
    expect(cachedAreaOf({ kind: 'changeset', id: 1, repository: 'art@local' })).toBeNull();
    expect(cachedAreaOf({ kind: 'user', name: 'ana' } satisfies CommentReference)).toBeNull();
  });
});
