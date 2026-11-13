import '../../../testing/fakeWindow';
import { describe, expect, it } from 'vitest';
import { repositoryPlace } from '@shared/domain/place';
import type { ReviewComment, ReviewConversation } from '@shared/domain/reviewConversation';
import { commentLinkPage, reviewCommentCopyTexts } from './commentLink';

const ON_LINE = { kind: 'line', revisionId: 29, itemId: 23, path: '/Assets/Scripts/SwitchFlow.cs', line: 11 } as const;

function comment(id: number, fields: Partial<ReviewComment> = {}): ReviewComment {
  return { id, guid: `g${id}`, author: 'ana', date: `2026-11-06T10:00:0${id % 10}+01:00`, text: '', kind: 'general', anchor: { kind: 'review' }, ...fields };
}

function conversation(...comments: ReviewComment[]): ReviewConversation {
  return { description: { id: 3, guid: 'd', text: 'Why', author: 'ana', date: '2026-11-06T09:00:00+01:00' }, comments, events: [] };
}

describe('commentLinkPage', () => {
  it('opens a comment on the whole review in the conversation, at its thread', () => {
    expect(commentLinkPage(41, 7, conversation(comment(7)))).toEqual({ page: { kind: 'codeReview', reviewId: 41, tab: 'conversation', focusThread: 7 }, found: true });
  });

  it('opens a reply in the conversation at its thread, going to the reply', () => {
    const replies = conversation(comment(7), comment(8, { parentId: 7, author: 'bob' }), comment(9, { parentId: 8 }));

    expect(commentLinkPage(41, 9, replies)).toEqual({ page: { kind: 'codeReview', reviewId: 41, tab: 'conversation', focusThread: 7, focusReply: 9 }, found: true });
  });

  it('opens a comment on a line in Changes, at its thread, in the mode it was written in', () => {
    expect(commentLinkPage(41, 7, conversation(comment(7, { kind: 'question', anchor: ON_LINE })))).toEqual({
      page: { kind: 'codeReview', reviewId: 41, tab: 'changes', focusPath: 'Assets/Scripts/SwitchFlow.cs', focusThread: 7 },
      found: true,
    });
    expect(commentLinkPage(41, 7, conversation(comment(7, { kind: 'changeRequest', anchor: ON_LINE, changesetId: 2 })))).toMatchObject({ page: { tab: 'changes', focusThread: 7, focusChangeset: 2 } });
  });

  it('opens a reply on a line at its thread in Changes, which shows it whole', () => {
    const onLine = conversation(comment(7, { kind: 'question', anchor: ON_LINE }), comment(8, { parentId: 7, author: 'bob' }));

    expect(commentLinkPage(41, 8, onLine)).toEqual(commentLinkPage(41, 7, onLine));
  });

  it('opens a comment written on an earlier version of the file as any on a line: Changes finds it there or among the outdated', () => {
    const earlier = conversation(comment(7, { kind: 'changeRequest', anchor: { ...ON_LINE, revisionId: 12 } }));

    expect(commentLinkPage(41, 7, earlier)).toMatchObject({ page: { tab: 'changes', focusPath: 'Assets/Scripts/SwitchFlow.cs', focusThread: 7 }, found: true });
  });

  it('opens a reply whose comment was deleted as the thread it starts', () => {
    expect(commentLinkPage(41, 8, conversation(comment(8, { parentId: 5 })))).toEqual({ page: { kind: 'codeReview', reviewId: 41, tab: 'conversation', focusThread: 8 }, found: true });
  });

  it('opens the description on the conversation, at its top', () => {
    expect(commentLinkPage(41, 3, conversation(comment(7)))).toEqual({ page: { kind: 'codeReview', reviewId: 41 }, found: true });
  });

  it('opens the review on its conversation for a comment it no longer has, saying so', () => {
    expect(commentLinkPage(41, 99, conversation(comment(7)))).toEqual({ page: { kind: 'codeReview', reviewId: 41 }, found: false });
    expect(commentLinkPage(41, 99, { comments: [], events: [] })).toEqual({ page: { kind: 'codeReview', reviewId: 41 }, found: false });
  });
});

describe('reviewCommentCopyTexts', () => {
  it('copies a comment as its text and its link, in the review on the place repository', () => {
    expect(reviewCommentCopyTexts(repositoryPlace('game@acme@unity'), 41, comment(7, { text: 'Rename it' }))).toEqual({
      comment: 'Rename it',
      link: 'uvcs://acme.unity/repos/game/code-reviews/41/-/comments/7',
    });
  });
});
