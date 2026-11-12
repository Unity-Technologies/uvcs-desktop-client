import { beforeEach, describe, expect, it } from 'vitest';
import { useNavigation } from '../../../app/navigation/navigationStore';
import type { CodeReviewTarget } from '@shared/domain/codeReview';
import type { ReviewComment } from '@shared/domain/reviewConversation';
import { threadsOf } from '../conversation/reviewThreads';
import type { LineThread } from './fileThreads';
import { conversationAt, showInConversation, threadDiffRequest } from './reviewComments';

function thread(fields: Partial<ReviewComment> = {}): LineThread {
  const root: ReviewComment = {
    id: 1,
    guid: 'g1',
    author: 'ana',
    date: '2026-11-06T10:00:00Z',
    text: 'Text',
    kind: 'changeRequest',
    anchor: { kind: 'line', revisionId: 30, itemId: 7, path: '/src/Player.cs', line: 4 },
    ...fields,
  };
  return threadsOf([root])[0] as LineThread;
}

const review = (target: CodeReviewTarget) => ({ target });

describe('threadDiffRequest', () => {
  it("asks a branch review's diff for the file in the whole branch", () => {
    expect(threadDiffRequest(review({ kind: 'branch', branch: '/main/task' }), thread(), 3)).toEqual({ path: 'src/Player.cs', changesetId: null, seq: 3 });
  });

  it('asks for the changeset a comment was written in', () => {
    expect(threadDiffRequest(review({ kind: 'branch', branch: '/main/task' }), thread({ changesetId: 12 }), 4)).toEqual({ path: 'src/Player.cs', changesetId: 12, seq: 4 });
  });

  // "Show in Changes" from How it was applied: a thread written on the whole branch, in the changeset that applied it.
  it('asks for the changeset the page names over the one the comment was written in', () => {
    expect(threadDiffRequest(review({ kind: 'branch', branch: '/main/task' }), thread(), 7, 15)).toEqual({ path: 'src/Player.cs', changesetId: 15, seq: 7 });
    expect(threadDiffRequest(review({ kind: 'branch', branch: '/main/task' }), thread({ changesetId: 12 }), 8, 15)).toEqual({ path: 'src/Player.cs', changesetId: 15, seq: 8 });
  });

  it('leaves the mode alone in a review with one: a changeset, a shelve', () => {
    expect(threadDiffRequest(review({ kind: 'changeset', changesetId: 12 }), thread({ changesetId: 12 }), 5)).toEqual({ path: 'src/Player.cs', seq: 5 });
    expect(threadDiffRequest(review({ kind: 'shelve', shelveId: 2 }), thread(), 6)).toEqual({ path: 'src/Player.cs', seq: 6 });
    expect(threadDiffRequest(review({ kind: 'changeset', changesetId: 12 }), thread(), 6, 12)).toEqual({ path: 'src/Player.cs', seq: 6 });
  });
});

describe('showInConversation', () => {
  beforeEach(() => useNavigation.setState({ view: 'codeReviews', pages: [] }));

  it("moves the review's page to its conversation at the thread, in place: Back leaves the review", () => {
    const changes = { kind: 'codeReview', reviewId: 41, tab: 'changes', focusPath: 'src/Player.cs', focusThread: 7 } as const;
    useNavigation.setState({ pages: [{ kind: 'codeReview', reviewId: 40 }, changes] });

    showInConversation(41, 7);

    expect(useNavigation.getState().pages).toEqual([{ kind: 'codeReview', reviewId: 40 }, conversationAt(41, 7)]);
  });
});
