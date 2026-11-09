import { describe, expect, it } from 'vitest';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { commentLocationPage, locationText, repliesText, replyAction, startsFolded, threadBadges, threadKindName, writtenLineText } from './threadBadges';
import { threadsOf } from './reviewThreads';

const ON_LINE = { kind: 'line', revisionId: 29, itemId: 23, path: '/Assets/Scripts/SwitchFlow.cs', line: 11 } as const;

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana', date: '', text: '', kind: 'general', anchor: { kind: 'review' }, ...fields };
}

const badgesOf = (...comments: ReviewComment[]) => threadBadges(threadsOf(comments)[0]!);

describe('threadBadges', () => {
  it('marks an open change request and question', () => {
    expect(badgesOf(comment(1, { kind: 'changeRequest', anchor: ON_LINE }))).toEqual({ kind: 'Change request', state: { label: 'Open', tone: 'open' } });
    expect(badgesOf(comment(1, { kind: 'question', anchor: ON_LINE }))).toEqual({ kind: 'Question', state: { label: 'Open', tone: 'open' } });
  });

  it('says how one was resolved: answered, applied in a changeset, discarded', () => {
    expect(badgesOf(comment(1, { kind: 'question' }), comment(2, { parentId: 1, kind: 'comment' })).state).toEqual({ label: 'Answered', tone: 'resolved' });
    expect(badgesOf(comment(1, { kind: 'changeRequest', appliedInChangeset: 4 }))).toEqual({ kind: 'Change request', state: { label: 'Applied in', tone: 'resolved' }, appliedIn: 4 });
    expect(badgesOf(comment(1, { kind: 'changeRequest' }), comment(2, { parentId: 1, kind: 'discard' })).state).toEqual({ label: 'Discarded', tone: 'discarded' });
  });

  it('marks nothing on a plain or general comment', () => {
    expect(badgesOf(comment(1))).toEqual({});
    expect(badgesOf(comment(1, { kind: 'comment', anchor: ON_LINE }))).toEqual({});
  });
});

describe('replyAction and threadKindName', () => {
  it('says a discarding reply discarded it, and nothing of another', () => {
    expect(replyAction({ kind: 'discard' })).toBe('discarded it');
    expect(replyAction({ kind: 'comment' })).toBeUndefined();
  });

  it('names a thread a change request, a question or a comment', () => {
    expect(threadKindName({ kind: 'question' })).toBe('Question');
    expect(threadKindName({ kind: 'changeRequest' })).toBe('Change request');
    expect(threadKindName({ kind: 'comment' })).toBe('Comment');
  });
});

describe('a comment on a line', () => {
  it("reads as its file's path, as the diff names it, and its line", () => {
    expect(locationText(ON_LINE)).toEqual({ folder: 'Assets/Scripts/', file: 'SwitchFlow.cs', line: ':11' });
  });

  it('reads a file at the top of the repository with no folder', () => {
    expect(locationText({ ...ON_LINE, path: '/README.md' })).toEqual({ folder: '', file: 'README.md', line: ':11' });
  });

  it('opens the review on its Changes tab at the thread, in its file', () => {
    expect(commentLocationPage(41, { id: 7, anchor: ON_LINE })).toEqual({ kind: 'codeReview', reviewId: 41, tab: 'changes', focusPath: 'Assets/Scripts/SwitchFlow.cs', focusThread: 7 });
  });

  it('opens one written changeset by changeset on that changeset', () => {
    expect(commentLocationPage(41, { id: 7, anchor: ON_LINE, changesetId: 2 })).toEqual({
      kind: 'codeReview',
      reviewId: 41,
      tab: 'changes',
      focusPath: 'Assets/Scripts/SwitchFlow.cs',
      focusThread: 7,
      focusChangeset: 2,
    });
  });
});

describe('startsFolded', () => {
  const [plain, open, answered, applied, discarded] = threadsOf([
    comment(1),
    comment(2, { kind: 'changeRequest' }),
    comment(3, { kind: 'question' }),
    comment(4, { kind: 'comment', parentId: 3 }),
    comment(5, { kind: 'changeRequest', appliedInChangeset: 90 }),
    comment(6, { kind: 'changeRequest' }),
    comment(7, { kind: 'discard', parentId: 6 }),
  ]);

  it('folds a settled thread: applied, discarded, answered', () => {
    expect([answered, applied, discarded].map((thread) => startsFolded(thread!))).toEqual([true, true, true]);
  });

  it('shows an open thread and a plain comment whole', () => {
    expect([plain, open].map((thread) => startsFolded(thread!))).toEqual([false, false]);
  });
});

describe('repliesText', () => {
  it('counts the replies, saying nothing of none', () => {
    expect(repliesText({ replies: [] })).toBeUndefined();
    expect(repliesText({ replies: [comment(2)] })).toBe('1 reply');
    expect(repliesText({ replies: [comment(2), comment(3)] })).toBe('2 replies');
  });
});

describe('writtenLineText', () => {
  it('names the line a comment was written on', () => {
    expect(writtenLineText({ line: 1962 })).toBe('line 1962');
  });
});
